import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { buildNotificationActionUrl } from '../notifications/notification-action-url.util';
import type { NotificationPayload } from '../notifications/notification-payload.types';

export type PushSubscribeInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
};

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  onModuleInit(): void {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privateKey = this.configService
      .get<string>('VAPID_PRIVATE_KEY')
      ?.trim();
    const subject =
      this.configService.get<string>('VAPID_SUBJECT')?.trim() ||
      'mailto:support@nikssens.com';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not configured — Web Push disabled (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)'
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getPublicKey(): string | null {
    if (!this.enabled) {
      return null;
    }

    return this.configService.get<string>('VAPID_PUBLIC_KEY')?.trim() || null;
  }

  async subscribe(userId: string, input: PushSubscribeInput) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async unsubscribeAll(userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId },
    });
  }

  async hasSubscription(userId: string): Promise<boolean> {
    const count = await this.prisma.pushSubscription.count({
      where: { userId },
    });
    return count > 0;
  }

  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body?: string | null;
      notificationPayload: NotificationPayload;
      type?: NotificationType;
      actorId?: string | null;
    }
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const frontendUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const url = buildNotificationActionUrl(
      frontendUrl,
      payload.notificationPayload,
      { type: payload.type, actorId: payload.actorId }
    );

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body ?? '',
      url,
    });

    await Promise.all(
      subscriptions.map(async subscription => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            body
          );
        } catch (error) {
          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? Number((error as { statusCode?: number }).statusCode)
              : undefined;

          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: subscription.id } })
              .catch(() => undefined);
            return;
          }

          this.logger.warn(
            `Push failed for ${subscription.id}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      })
    );
  }
}
