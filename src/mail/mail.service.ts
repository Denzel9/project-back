import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { buildPasswordResetEmail } from './templates/password-reset';
import { buildEmailConfirmEmail } from './templates/email-confirm';
import { buildAccountInviteEmail } from './templates/account-invite';
import {
  ApplicationReceivedEmailParams,
  buildApplicationReceivedEmail,
} from './templates/application-received';
import {
  buildNotificationEmail,
  NotificationEmailParams,
} from './templates/notification';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly smtpEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.smtpEnabled =
      this.configService.get<string>('SMTP_ENABLED') !== 'false';

    if (!this.smtpEnabled) {
      this.logger.warn(
        'SMTP_ENABLED=false — письма не отправляются, содержимое пишется в лог'
      );
      return;
    }

    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASSWORD');
    const port = Number(this.configService.getOrThrow<string>('SMTP_PORT'));
    const secure =
      this.configService.get<string>('SMTP_SECURE') === 'true' || port === 465;

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port,
      secure,
      requireTLS: !secure && port === 587,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: { rejectUnauthorized: false },
      ...(smtpUser && smtpPass
        ? { auth: { user: smtpUser, pass: smtpPass } }
        : {}),
    });
  }

  private getFrontendUrl(): string {
    return this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const resetUrl = `${frontendUrl}/auth?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildPasswordResetEmail(
      resetUrl,
      frontendUrl
    );

    await this.sendMail({ to, subject, text, html });
  }

  async sendEmailConfirmationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const confirmUrl = `${frontendUrl}/auth/confirm-email?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildEmailConfirmEmail(
      confirmUrl,
      frontendUrl
    );

    await this.sendMail({ to, subject, text, html });
  }

  async sendAccountInviteEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const inviteUrl = `${frontendUrl}/invites/accept?token=${encodeURIComponent(
      token
    )}`;
    const { subject, text, html } = buildAccountInviteEmail(
      inviteUrl,
      frontendUrl
    );

    await this.sendMail({ to, subject, text, html });
  }

  async sendApplicationReceivedEmail(
    to: string,
    params: Omit<ApplicationReceivedEmailParams, 'frontendUrl'>
  ): Promise<void> {
    const { subject, text, html } = buildApplicationReceivedEmail({
      ...params,
      frontendUrl: this.getFrontendUrl(),
    });

    await this.sendMail({ to, subject, text, html });
  }

  async sendNotificationEmail(
    to: string,
    params: Omit<NotificationEmailParams, 'frontendUrl'>
  ): Promise<void> {
    const { subject, text, html } = buildNotificationEmail({
      ...params,
      frontendUrl: this.getFrontendUrl(),
    });

    await this.sendMail({ to, subject, text, html });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    if (!this.smtpEnabled || !this.transporter) {
      this.logger.warn(
        `[SMTP dry-run] to=${options.to} subject="${options.subject}"\n${options.text}`
      );
      return;
    }

    const from = this.configService.getOrThrow<string>('SMTP_FROM');
    const sendTimeoutMs = 12_000;

    try {
      await Promise.race([
        this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`SMTP timeout after ${sendTimeoutMs}ms`));
          }, sendTimeoutMs);
        }),
      ]);
    } catch (error) {
      this.logger.error('Failed to send email', error);
      throw new InternalServerErrorException('Не удалось отправить письмо');
    }
  }
}
