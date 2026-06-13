import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { MembershipRole, Prisma, Role } from '@prisma/client';
import { AccountMembershipService } from '../accounts/account-membership.service';
import { AccountsService } from '../accounts/accounts.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { getRefreshExpiresIn } from './auth-cookies';
import {
  AuthResponse,
  AuthSessionUser,
  AuthTokens,
  AuthUser,
  JwtPayload,
  PasswordResetPayload,
  RefreshJwtPayload,
} from './auth.types';
import { InvitesService } from './invites.service';
import { LoginDto } from './dto/login.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterCreatorDto } from './dto/register-creator.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { SwitchProfileDto } from './dto/switch-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountsService: AccountsService,
    private readonly membershipService: AccountMembershipService,
    private readonly invitesService: InvitesService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService
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

  revokeMembership(authUser: AuthUser, membershipId: string) {
    return this.membershipService.revokeMembership(
      membershipId,
      authUser.accountId
    );
  }

  async getProfile(authUser: AuthUser): Promise<AuthSessionUser> {
    const user = await this.usersService.findById(authUser.userId);

    if (!user) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    return {
      id: user.id,
      role: user.role,
      membershipRole: authUser.membershipRole,
    };
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

  private buildAuthResponse(
    account: { id: string; email: string },
    user: { id: string; role: Role },
    membershipRole: MembershipRole,
    rememberMe = false
  ): AuthResponse {
    return {
      user: {
        id: user.id,
        role: user.role,
        membershipRole,
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
