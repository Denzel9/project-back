import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { Job, Queue, QueueEvents } from 'bullmq';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getBullMqConnection } from '../redis/redis-connection';
import { MAIL_QUEUE, MAIL_SEND_JOB } from './mail.constants';
import type { SendEmailJobPayload } from './mail.types';
import { buildPasswordResetEmail } from './templates/password-reset';
import { buildEmailConfirmEmail } from './templates/email-confirm';
import { buildAccountInviteEmail } from './templates/account-invite';
import {
  buildNotificationEmail,
  NotificationEmailParams,
} from './templates/notification';

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2_000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
};

/** Invite waits for delivery so orphan invites can be rolled back on failure. */
const INVITE_WAIT_MS = 60_000;

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly smtpEnabled: boolean;
  private readonly queueEvents: QueueEvents;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue<SendEmailJobPayload>
  ) {
    this.smtpEnabled =
      this.configService.get<string>('SMTP_ENABLED') !== 'false';

    this.queueEvents = new QueueEvents(MAIL_QUEUE, {
      connection: getBullMqConnection(this.configService),
    });

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

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close().catch(() => undefined);
  }

  private getFrontendUrl(): string {
    return this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
  }

  /** Публичный URL API для статики писем (/assets/...) */
  private getPublicApiUrl(): string {
    const configured = this.configService.get<string>('PUBLIC_API_URL');
    if (configured?.trim()) {
      return configured.replace(/\/$/, '');
    }

    const port = this.configService.get<string>('PORT') ?? '3010';
    return `http://localhost:${port}`;
  }

  private getLogoUrl(): string {
    return `${this.getPublicApiUrl()}/assets/mail/Primary.png`;
  }

  private getNotificationSettingsUrl(): string {
    return `${this.getFrontendUrl()}/settings/notification`;
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const resetUrl = `${frontendUrl}/auth?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildPasswordResetEmail(
      resetUrl,
      frontendUrl,
      this.getLogoUrl()
    );

    await this.enqueueMail({ to, subject, text, html });
  }

  async sendEmailConfirmationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const confirmUrl = `${frontendUrl}/auth/confirm-email?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildEmailConfirmEmail(
      confirmUrl,
      frontendUrl,
      this.getLogoUrl()
    );

    await this.enqueueMail({ to, subject, text, html });
  }

  async sendAccountInviteEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const inviteUrl = `${frontendUrl}/invites/accept?token=${encodeURIComponent(
      token
    )}`;
    const { subject, text, html } = buildAccountInviteEmail(
      inviteUrl,
      frontendUrl,
      this.getLogoUrl()
    );

    await this.enqueueMail(
      { to, subject, text, html },
      { waitUntilFinished: true }
    );
  }

  async sendNotificationEmail(
    to: string,
    params: Omit<NotificationEmailParams, 'frontendUrl' | 'logoUrl'>
  ): Promise<void> {
    const { subject, text, html } = buildNotificationEmail({
      ...params,
      frontendUrl: this.getFrontendUrl(),
      logoUrl: this.getLogoUrl(),
    });

    await this.enqueueMail({
      to,
      subject,
      text,
      html,
      listUnsubscribeUrl: this.getNotificationSettingsUrl(),
    });
  }

  /**
   * Actual SMTP delivery — called by the BullMQ worker (or sync dry-run path).
   */
  async deliverMail(options: SendEmailJobPayload): Promise<void> {
    if (!this.smtpEnabled || !this.transporter) {
      this.logger.warn(
        `[SMTP dry-run] to=${options.to} subject="${options.subject}"\n${options.text}`
      );
      return;
    }

    const from = this.configService.getOrThrow<string>('SMTP_FROM');
    const sendTimeoutMs = 12_000;
    const headers: Record<string, string> = {};

    if (options.listUnsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${options.listUnsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    try {
      await Promise.race([
        this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
          ...(Object.keys(headers).length > 0 && { headers }),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`SMTP timeout after ${sendTimeoutMs}ms`));
          }, sendTimeoutMs);
        }),
      ]);
    } catch (error) {
      this.logger.error('Failed to send email', error);
      Sentry.captureException(error);
      throw error;
    }
  }

  private async enqueueMail(
    payload: SendEmailJobPayload,
    options?: { waitUntilFinished?: boolean }
  ): Promise<void> {
    if (!this.smtpEnabled) {
      await this.deliverMail(payload);
      return;
    }

    let job: Job<SendEmailJobPayload>;

    try {
      job = await this.mailQueue.add(MAIL_SEND_JOB, payload, DEFAULT_JOB_OPTIONS);
    } catch (error) {
      this.logger.error('Failed to enqueue email', error);
      Sentry.captureException(error);
      throw new InternalServerErrorException('Не удалось отправить письмо');
    }

    if (!options?.waitUntilFinished) {
      return;
    }

    try {
      await job.waitUntilFinished(this.queueEvents, INVITE_WAIT_MS);
    } catch (error) {
      this.logger.error('Email job failed after retries', error);
      Sentry.captureException(error);
      throw new InternalServerErrorException('Не удалось отправить письмо');
    }
  }
}
