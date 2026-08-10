import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipRole, NotificationType, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AccountMembershipService } from '../accounts/account-membership.service';
import { AccountsService } from '../accounts/accounts.service';
import { PrimeSubscriptionService } from '../billing/prime-subscription.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly membershipService: AccountMembershipService,
    private readonly primeSubscriptionService: PrimeSubscriptionService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService
  ) {}

  async createInvite(
    inviterAccountId: string,
    dto: { email: string; userId: string; role: MembershipRole }
  ) {
    if (dto.role === MembershipRole.OWNER) {
      throw new BadRequestException('Нельзя приглашать с ролью владельца');
    }

    await this.membershipService.assertCanInvite(inviterAccountId, dto.userId);

    const profile = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!profile) {
      throw new NotFoundException('Профиль не найден');
    }

    if (profile.role !== Role.CREATOR && profile.role !== Role.COMPANY) {
      throw new BadRequestException(
        'Приглашать можно только к профилю креатора или компании'
      );
    }

    if (profile.role === Role.COMPANY) {
      await this.assertCompanyPrimeForManagers(profile.id);
    }

    const existingMembership = await this.prisma.accountMembership.findFirst({
      where: {
        userId: dto.userId,
        account: { email: dto.email },
      },
    });

    if (existingMembership) {
      throw new ConflictException('У этого email уже есть доступ к профилю');
    }

    const pendingInvite = await this.prisma.accountInvite.findFirst({
      where: {
        userId: dto.userId,
        email: dto.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingInvite) {
      throw new ConflictException('Приглашение уже отправлено');
    }

    const expiresInHours = Number(
      this.configService.get<string>('INVITE_EXPIRES_IN_HOURS') ?? '168'
    );
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invite = await this.prisma.accountInvite.create({
      data: {
        userId: dto.userId,
        inviterId: inviterAccountId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendAccountInviteEmail(dto.email, token);
    } catch (error) {
      this.logger.error(
        `Не удалось отправить invite email (${invite.id})`,
        error instanceof Error ? error.stack : String(error)
      );

      await this.prisma.accountInvite
        .delete({ where: { id: invite.id } })
        .catch(() => undefined);

      throw new BadRequestException(
        'Не удалось отправить приглашение на email. Попробуйте ещё раз позже'
      );
    }

    const inviteeAccount = await this.prisma.account.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const inviteeUserId = inviteeAccount?.memberships[0]?.userId;

    if (inviteeUserId) {
      await this.notificationsService.notify({
        recipientId: inviteeUserId,
        actorId: dto.userId,
        type: NotificationType.TEAM_INVITE,
        title: 'Приглашение в команду',
        body: `Вам предоставят доступ к профилю`,
        payload: {
          entityType: 'invite',
          entityId: invite.id,
          meta: {
            inviteId: invite.id,
            role: invite.role,
          },
        },
      });
    }

    return {
      id: invite.id,
      email: invite.email,
      userId: invite.userId,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(accountId: string, token: string) {
    const account = await this.accountsService.findById(accountId);

    if (!account) {
      throw new NotFoundException('Аккаунт не найден');
    }

    const invite = await this.prisma.accountInvite.findUnique({
      where: { token },
    });

    if (!invite || invite.acceptedAt) {
      throw new BadRequestException('Недействительное приглашение');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Приглашение просрочено');
    }

    if (invite.email.toLowerCase() !== account.email.toLowerCase()) {
      throw new ForbiddenException('Приглашение отправлено на другой email');
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: invite.userId },
      select: { id: true, role: true },
    });

    if (!profile) {
      throw new NotFoundException('Профиль не найден');
    }

    if (profile.role === Role.COMPANY) {
      await this.assertCompanyPrimeForManagers(profile.id);
    }

    const existingMembership = await this.membershipService.getMembership(
      accountId,
      invite.userId
    );

    if (existingMembership) {
      throw new ConflictException('Доступ к профилю уже есть');
    }

    await this.prisma.$transaction(async tx => {
      await tx.accountMembership.create({
        data: {
          accountId,
          userId: invite.userId,
          role: invite.role,
        },
      });

      await tx.accountInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });

    return { userId: invite.userId, role: invite.role };
  }

  private async assertCompanyPrimeForManagers(companyUserId: string) {
    const subscription =
      await this.primeSubscriptionService.getSubscription(companyUserId);

    if (!subscription.isPrime) {
      throw new ForbiddenException(
        'Чтобы добавить менеджера, подключите Prime-подписку для профиля компании'
      );
    }
  }
}
