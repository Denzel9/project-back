import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AccountsModule } from '../accounts/accounts.module';
import { BillingModule } from '../billing/billing.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitesService } from './invites.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MembershipWriteGuard } from './guards/membership-write.guard';
import { EmailConfirmedGuard } from './guards/email-confirmed.guard';

@Module({
  imports: [
    AccountsModule,
    forwardRef(() => BillingModule),
    forwardRef(() => UsersModule),
    MailModule,
    forwardRef(() => NotificationsModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>(
            'JWT_ACCESS_EXPIRES_IN'
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    InvitesService,
    JwtStrategy,
    MembershipWriteGuard,
    EmailConfirmedGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    MembershipWriteGuard,
    EmailConfirmedGuard,
  ],
})
export class AuthModule {}
