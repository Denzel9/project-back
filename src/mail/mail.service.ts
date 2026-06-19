import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { buildPasswordResetEmail } from './templates/password-reset';
import { buildAccountInviteEmail } from './templates/account-invite';
import {
  ApplicationReceivedEmailParams,
  buildApplicationReceivedEmail,
} from './templates/application-received';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.configService.getOrThrow<string>('SMTP_PORT')),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      ...(smtpUser && smtpPass
        ? { auth: { user: smtpUser, pass: smtpPass } }
        : {}),
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/auth?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildPasswordResetEmail(resetUrl);

    await this.sendMail({ to, subject, text, html });
  }

  async sendAccountInviteEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const inviteUrl = `${frontendUrl}/invites/accept?token=${encodeURIComponent(
      token
    )}`;
    const { subject, text, html } = buildAccountInviteEmail(inviteUrl);

    await this.sendMail({ to, subject, text, html });
  }

  async sendApplicationReceivedEmail(
    to: string,
    params: ApplicationReceivedEmailParams
  ): Promise<void> {
    const { subject, text, html } = buildApplicationReceivedEmail(params);

    await this.sendMail({ to, subject, text, html });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const from = this.configService.getOrThrow<string>('SMTP_FROM');

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch (error) {
      this.logger.error('Failed to send email', error);
      throw new InternalServerErrorException('Не удалось отправить письмо');
    }
  }
}
