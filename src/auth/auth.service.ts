import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { MembershipRole, NotificationType, Prisma, Role } from '@prisma/client';
import { AccountMembershipService } from '../accounts/account-membership.service';
import { AccountsService } from '../accounts/accounts.service';
import { PrimeSubscriptionService } from '../billing/prime-subscription.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { getRefreshExpiresIn } from './auth-cookies';
import {
  AuthResponse,
  AuthSessionUser,
  AuthTokens,
  AuthUser,
  EmailConfirmPayload,
  JwtPayload,
  PasswordResetPayload,
  RefreshJwtPayload,
} from './auth.types';
import { InvitesService } from './invites.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterCreatorDto } from './dto/register-creator.dto';
import { RegisterManagerDto } from './dto/register-manager.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { SwitchProfileDto } from './dto/switch-profile.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly membershipService: AccountMembershipService,
    @Inject(forwardRef(() => PrimeSubscriptionService))
    private readonly primeSubscriptionService: PrimeSubscriptionService,
    private readonly invitesService: InvitesService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService
  ) {}

  async registerCreator(dto: RegisterCreatorDto) {
    await this.accountsService.ensureEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async tx => {
      const account = await tx.account.create({
        data: {
          email: dto.email,
          password: passwordHash,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          role: Role.CREATOR,
          ...(dto.contacts !== undefined && {
            contacts: dto.contacts as unknown as Prisma.InputJsonValue,
          }),
          phone: dto.phone,
          location: dto.location,
          avatar: dto.avatar,
          bio: dto.bio,
          aboutMe: dto.aboutMe,
          creatorProfile: {
            create: {
              name: dto.name,
              lastName: dto.lastName,
            },
          },
        },
      });

      const membership = await tx.accountMembership.create({
        data: {
          accountId: account.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });

      return { account, user, membership };
    });

    await this.safeSendEmailConfirmation(
      result.account.email,
      result.user.id,
      result.account.id
    );

    return this.buildAuthResponse(
      result.account,
      result.user,
      result.membership.role,
      true
    );
  }

  async registerCompany(dto: RegisterCompanyDto) {
    await this.accountsService.ensureEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async tx => {
      const account = await tx.account.create({
        data: {
          email: dto.email,
          password: passwordHash,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          role: Role.COMPANY,
          ...(dto.contacts !== undefined && {
            contacts: dto.contacts as unknown as Prisma.InputJsonValue,
          }),
          phone: dto.phone,
          location: dto.location,
          avatar: dto.avatar,
          bio: dto.bio,
          aboutMe: dto.aboutMe,
          companyProfile: {
            create: {
              companyName: dto.companyName,
            },
          },
        },
      });

      const membership = await tx.accountMembership.create({
        data: {
          accountId: account.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });

      return { account, user, membership };
    });

    await this.safeSendEmailConfirmation(
      result.account.email,
      result.user.id,
      result.account.id
    );

    return this.buildAuthResponse(
      result.account,
      result.user,
      result.membership.role,
      true
    );
  }

  async registerManager(dto: RegisterManagerDto) {
    await this.accountsService.ensureEmailAvailable(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async tx => {
      const account = await tx.account.create({
        data: {
          email: dto.email,
          password: passwordHash,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          role: Role.MANAGER,
          person: {
            name: dto.name,
            lastName: dto.lastName,
          } as Prisma.InputJsonValue,
        },
      });

      const membership = await tx.accountMembership.create({
        data: {
          accountId: account.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });

      return { account, user, membership };
    });

    await this.safeSendEmailConfirmation(
      result.account.email,
      result.user.id,
      result.account.id
    );

    return this.buildAuthResponse(
      result.account,
      result.user,
      result.membership.role,
      true
    );
  }

  async login(dto: LoginDto) {
    const account = await this.accountsService.findByEmail(dto.email);

    if (!account) {
      throw new ForbiddenException('Неверный email или пароль');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      account.password
    );

    if (!passwordMatches) {
      throw new ForbiddenException('Неверный email или пароль');
    }

    const membership = await this.membershipService.getDefaultProfile(
      account.id
    );

    return this.buildAuthResponse(
      account,
      membership.user,
      membership.role,
      dto.rememberMe ?? false
    );
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const account = await this.accountsService.findByEmail(dto.email);

    if (account) {
      const token = this.createPasswordResetToken(account.id);
      await this.mailService.sendPasswordResetEmail(account.email, token);
    }

    return {
      message:
        'Если аккаунт с таким email существует, мы отправили письмо со ссылкой для сброса пароля',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const accountId = this.verifyPasswordResetToken(dto.token);
    const account = await this.accountsService.findById(accountId);

    if (!account) {
      throw new BadRequestException('Недействительный или просроченный токен');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.accountsService.updatePassword(accountId, passwordHash);

    return { message: 'Пароль успешно изменён' };
  }

  async verifyPassword(authUser: AuthUser, dto: VerifyPasswordDto) {
    const account = await this.accountsService.findById(authUser.accountId);

    if (!account) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const passwordMatches = await bcrypt.compare(dto.password, account.password);

    if (!passwordMatches) {
      throw new ForbiddenException('Неверный пароль');
    }

    return { valid: true };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Отсутствует refresh-токен');
    }

    let payload: RefreshJwtPayload;

    try {
      payload = this.jwtService.verify<RefreshJwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Неверный refresh-токен');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Неверный refresh-токен');
    }

    const membership = await this.membershipService.getMembership(
      payload.accountId,
      payload.sub
    );

    if (!membership) {
      throw new UnauthorizedException('Неверный refresh-токен');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Неверный refresh-токен');
    }

    const account = await this.accountsService.findById(payload.accountId);

    if (!account) {
      throw new UnauthorizedException('Неверный refresh-токен');
    }

    return this.buildAuthResponse(
      account,
      user,
      membership.role,
      payload.remember === true
    );
  }

  async listProfiles(authUser: AuthUser) {
    return this.membershipService.listProfiles(
      authUser.accountId,
      authUser.userId
    );
  }

  async listProfileMembers(authUser: AuthUser) {
    return this.membershipService.listProfileMembers(
      authUser.accountId,
      authUser.userId
    );
  }

  async switchProfile(
    authUser: AuthUser,
    dto: SwitchProfileDto,
    refreshToken?: string
  ) {
    const membership = await this.membershipService.assertMembership(
      authUser.accountId,
      dto.userId
    );
    const user = await this.usersService.findById(dto.userId);

    if (!user) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const account = await this.accountsService.findById(authUser.accountId);

    if (!account) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const rememberMe = this.parseRememberMeFromRefreshToken(refreshToken);

    return this.buildAuthResponse(account, user, membership.role, rememberMe);
  }

  createInvite(authUser: AuthUser, dto: CreateInviteDto) {
    return this.invitesService.createInvite(authUser.accountId, dto);
  }

  acceptInvite(authUser: AuthUser, dto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(authUser.accountId, dto.token);
  }

  async revokeMembership(authUser: AuthUser, membershipId: string) {
    const membership = await this.membershipService.revokeMembership(
      membershipId,
      authUser.accountId
    );

    if (membership.userId !== authUser.userId) {
      const profileName = this.getProfileDisplayName(membership.user);

      await this.notificationsService.notify({
        recipientId: membership.userId,
        actorId: authUser.userId,
        type: NotificationType.MEMBERSHIP_REVOKED,
        title: 'Доступ к профилю отозван',
        body: `Профиль: ${profileName}`,
        payload: {
          entityType: 'invite',
          entityId: membership.id,
          meta: {
            membershipId: membership.id,
            profileName,
          },
        },
      });
    }
  }

  private getProfileDisplayName(user: {
    role: Role;
    email?: string;
    person?: unknown;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): string {
    if (user.role === Role.CREATOR && user.creatorProfile) {
      return `${user.creatorProfile.name} ${user.creatorProfile.lastName}`.trim();
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return user.companyProfile.companyName;
    }

    if (user.role === Role.MANAGER) {
      const fromPerson = this.getPersonFullName(user.person);
      if (fromPerson) return fromPerson;
      return user.email ?? 'Менеджер';
    }

    return user.role;
  }

  private getPersonFullName(person: unknown): string | null {
    if (!person || typeof person !== 'object' || Array.isArray(person)) {
      return null;
    }

    const record = person as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const lastName =
      typeof record.lastName === 'string' ? record.lastName.trim() : '';
    const fullName = `${name} ${lastName}`.trim();

    return fullName || null;
  }

  async getProfile(authUser: AuthUser): Promise<AuthSessionUser> {
    const user = await this.usersService.findById(authUser.userId);

    if (!user) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const subscription = await this.primeSubscriptionService.getSubscription(
      authUser.userId
    );

    return {
      id: user.id,
      accountId: authUser.accountId,
      role: user.role,
      membershipRole: authUser.membershipRole,
      isVerified: user.isVerified,
      isEmailConfirmed: user.isEmailConfirmed,
      isPrime: subscription.isPrime,
      primeStatus: subscription.status,
      primeExpiresAt: subscription.expiresAt?.toISOString() ?? null,
    };
  }

  async sendConfirmEmail(authUser: AuthUser) {
    const user = await this.usersService.findById(authUser.userId);

    if (!user) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    if (user.isEmailConfirmed) {
      return { message: 'Почта уже подтверждена' };
    }

    const account = await this.accountsService.findById(authUser.accountId);

    if (!account) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    const to = account.email || user.email;

    if (!to) {
      throw new BadRequestException('У аккаунта не указан email');
    }

    // Не блокируем HTTP на SMTP (Mailtrap/сеть могут висеть минутами)
    void this.safeSendEmailConfirmation(to, user.id, account.id);

    return {
      message: 'Письмо для подтверждения почты отправлено',
    };
  }

  async confirmEmail(dto: ConfirmEmailDto) {
    const { userId } = this.verifyEmailConfirmToken(dto.token);
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('Недействительный или просроченный токен');
    }

    if (user.isEmailConfirmed) {
      return { message: 'Почта уже подтверждена' };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailConfirmed: true },
    });

    return { message: 'Почта успешно подтверждена' };
  }

  private async safeSendEmailConfirmation(
    email: string,
    userId: string,
    accountId: string
  ) {
    try {
      const token = this.createEmailConfirmToken(userId, accountId);
      const frontendUrl = this.configService
        .getOrThrow<string>('FRONTEND_URL')
        .replace(/\/$/, '');
      const confirmUrl = `${frontendUrl}/auth/confirm-email?token=${encodeURIComponent(token)}`;

      this.logger.log(`Confirm email link for ${email}: ${confirmUrl}`);

      await this.mailService.sendEmailConfirmationEmail(email, token);
    } catch (error) {
      this.logger.error(
        `Failed to send email confirmation to ${email}`,
        error instanceof Error ? error.stack : error
      );
    }
  }

  private createEmailConfirmToken(userId: string, accountId: string): string {
    const payload: EmailConfirmPayload = {
      sub: userId,
      accountId,
      type: 'email-confirm',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_EMAIL_CONFIRM_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_EMAIL_CONFIRM_EXPIRES_IN'
      ) as SignOptions['expiresIn'],
    });
  }

  private verifyEmailConfirmToken(token: string): {
    userId: string;
    accountId: string;
  } {
    try {
      const payload = this.jwtService.verify<EmailConfirmPayload>(token, {
        secret: this.configService.getOrThrow<string>(
          'JWT_EMAIL_CONFIRM_SECRET'
        ),
      });

      if (payload.type !== 'email-confirm' || !payload.sub || !payload.accountId) {
        throw new BadRequestException(
          'Недействительный или просроченный токен'
        );
      }

      return { userId: payload.sub, accountId: payload.accountId };
    } catch {
      throw new BadRequestException('Недействительный или просроченный токен');
    }
  }

  private createPasswordResetToken(accountId: string): string {
    const payload: PasswordResetPayload = {
      sub: accountId,
      type: 'password-reset',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>(
        'JWT_PASSWORD_RESET_SECRET'
      ),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_PASSWORD_RESET_EXPIRES_IN'
      ) as SignOptions['expiresIn'],
    });
  }

  private verifyPasswordResetToken(token: string): string {
    try {
      const payload = this.jwtService.verify<PasswordResetPayload>(token, {
        secret: this.configService.getOrThrow<string>(
          'JWT_PASSWORD_RESET_SECRET'
        ),
      });

      if (payload.type !== 'password-reset') {
        throw new BadRequestException(
          'Недействительный или просроченный токен'
        );
      }

      return payload.sub;
    } catch {
      throw new BadRequestException('Недействительный или просроченный токен');
    }
  }

  private parseRememberMeFromRefreshToken(refreshToken?: string): boolean {
    if (!refreshToken) {
      return false;
    }

    try {
      const payload = this.jwtService.verify<RefreshJwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      return payload.type === 'refresh' && payload.remember === true;
    } catch {
      return false;
    }
  }

  private async buildAuthResponse(
    account: { id: string; email: string },
    user: {
      id: string;
      role: Role;
      isVerified: boolean;
      isEmailConfirmed: boolean;
    },
    membershipRole: MembershipRole,
    rememberMe = false
  ): Promise<AuthResponse> {
    const subscription = await this.primeSubscriptionService.getSubscription(
      user.id
    );

    return {
      user: {
        id: user.id,
        accountId: account.id,
        role: user.role,
        membershipRole,
        isVerified: user.isVerified,
        isEmailConfirmed: user.isEmailConfirmed,
        isPrime: subscription.isPrime,
        primeStatus: subscription.status,
        primeExpiresAt: subscription.expiresAt?.toISOString() ?? null,
      },
      tokens: this.issueTokens(account, user, membershipRole, rememberMe),
      rememberMe,
    };
  }

  private issueTokens(
    account: { id: string; email: string },
    user: { id: string; role: Role },
    membershipRole: MembershipRole,
    rememberMe = false
  ): AuthTokens {
    const accessPayload: JwtPayload = {
      sub: user.id,
      accountId: account.id,
      email: account.email,
      role: user.role,
      membershipRole,
    };

    const refreshPayload: RefreshJwtPayload = {
      sub: user.id,
      accountId: account.id,
      type: 'refresh',
      remember: rememberMe,
    };

    const refreshExpiresIn = getRefreshExpiresIn(rememberMe);

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES_IN'
      ) as SignOptions['expiresIn'],
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn as SignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }
}
