import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InviteKind,
  MembershipRole,
  NotificationType,
  Role,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AccountMembershipService } from '../accounts/account-membership.service';
import { AccountsService } from '../accounts/accounts.service';
import { PrimeSubscriptionService } from '../billing/prime-subscription.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';

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

  async createInvite(inviterAccountId: string, dto: CreateInviteDto) {
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

    // Мультиаккаунт (менеджеры): для компании нужен Prime
    if (dto.kind === InviteKind.TEAM && profile.role === Role.COMPANY) {
      await this.assertCompanyPrimeForManagers(profile.id);
    }

    const email = dto.email.trim().toLowerCase();

    const inviteeAccount = await this.accountsService.findByEmail(email);
    if (inviteeAccount) {
      await this.assertInviteKindMatchesAccount(dto.kind, inviteeAccount.id);
    }

    const existingMembership = await this.prisma.accountMembership.findFirst({
      where: {
        userId: dto.userId,
        account: { email },
      },
    });

    if (existingMembership) {
      throw new ConflictException('У этого email уже есть доступ к профилю');
    }

    const pendingInvite = await this.prisma.accountInvite.findFirst({
      where: {
        userId: dto.userId,
        email,
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
        email,
        role: dto.role,
        kind: dto.kind,
        token,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendAccountInviteEmail(email, token);
    } catch (error) {
      await this.prisma.accountInvite
        .delete({ where: { id: invite.id } })
        .catch(() => undefined);

      this.logger.error(
        `Failed to send invite email to ${email}`,
        error instanceof Error ? error.stack : undefined
      );

      throw new BadRequestException(
        'Не удалось отправить приглашение на email. Попробуйте ещё раз позже'
      );
    }

    const inviteeAccountForNotify = await this.prisma.account.findUnique({
      where: { email },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const inviteeUserId = inviteeAccountForNotify?.memberships[0]?.userId;

    if (inviteeUserId) {
      const title =
        dto.kind === InviteKind.CROSS
          ? 'Приглашение к связанному профилю'
          : 'Приглашение в команду';

      await this.notificationsService.notify({
        recipientId: inviteeUserId,
        actorId: dto.userId,
        type: NotificationType.TEAM_INVITE,
        title,
        body: 'Вам предоставят доступ к профилю',
        payload: {
          entityType: 'invite',
          entityId: invite.id,
          meta: {
            inviteId: invite.id,
            role: invite.role,
            kind: invite.kind,
          },
        },
      });
    }

    return {
      id: invite.id,
      email: invite.email,
      userId: invite.userId,
      role: invite.role,
      kind: invite.kind,
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

    await this.assertInviteKindMatchesAccount(invite.kind, accountId);

    const profile = await this.prisma.user.findUnique({
      where: { id: invite.userId },
      select: { id: true, role: true },
    });

    if (!profile) {
      throw new NotFoundException('Профиль не найден');
    }

    if (invite.kind === InviteKind.TEAM && profile.role === Role.COMPANY) {
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

    return { userId: invite.userId, role: invite.role, kind: invite.kind };
  }

  private async assertInviteKindMatchesAccount(
    kind: InviteKind,
    accountId: string
  ) {
    const accountRole =
      await this.membershipService.getAccountOwnerUserRole(accountId);

    if (kind === InviteKind.TEAM) {
      if (accountRole !== Role.MANAGER) {
        throw new BadRequestException(
          'В команду можно пригласить только менеджера'
        );
      }
      return;
    }

    if (kind === InviteKind.CROSS) {
      if (accountRole === Role.MANAGER) {
        throw new BadRequestException(
          'Менеджеру нельзя выдать кросс-доступ'
        );
      }
      if (accountRole !== Role.COMPANY && accountRole !== Role.CREATOR) {
        throw new BadRequestException(
          'Кросс-доступ можно выдать только компании или исполнителю'
        );
      }
    }
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
