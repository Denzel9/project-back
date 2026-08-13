import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipRole,
  MessengerProvider,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { MessengerDeliveryService } from '../integrations/messenger-delivery.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { UserConfigService } from '../user-config/user-config.service';
import { ChatEmailThrottleService } from './chat-email-throttle.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NotificationActorDto,
  NotificationResponseDto,
} from './dto/notification-response.dto';
import { buildNotificationActionUrl } from './notification-action-url.util';
import { NotificationPayload } from './notification-payload.types';
import { NotificationsGateway } from './notifications.gateway';
import {
  EMAIL_ENABLED_NOTIFICATION_TYPES,
  notificationInclude,
  NotificationWithActor,
  NotifyInput,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly userConfigService: UserConfigService,
    private readonly chatEmailThrottle: ChatEmailThrottleService,
    private readonly messengerDelivery: MessengerDeliveryService,
    private readonly pushService: PushService
  ) {}

  async notify(input: NotifyInput): Promise<NotificationResponseDto | null> {
    const inAppEnabled = await this.userConfigService.isInAppEnabled(
      input.recipientId,
      input.type
    );

    let response: NotificationResponseDto | null = null;

    if (inAppEnabled) {
      const notification = await this.prisma.notification.create({
        data: {
          recipientId: input.recipientId,
          actorId: input.actorId ?? null,
          ...(input.actor && {
            actorAccountId: input.actor.accountId,
            actorDisplayName: input.actor.displayName,
            actorKind: input.actor.kind,
          }),
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          payload: input.payload as Prisma.InputJsonValue,
        },
        include: notificationInclude,
      });

      const unreadCount = await this.countUnread(input.recipientId);
      response = this.toResponse(notification);

      this.notificationsGateway.broadcastNotification(
        input.recipientId,
        response,
        unreadCount
      );
    }

    const shouldSendEmail =
      input.sendEmail !== false &&
      EMAIL_ENABLED_NOTIFICATION_TYPES.has(input.type) &&
      (await this.userConfigService.isEmailEnabled(
        input.recipientId,
        input.type
      ));

    if (shouldSendEmail) {
      const emailInput = await this.prepareEmailInput(input);
      if (emailInput) {
        await this.sendEmailNotification(input.recipientId, emailInput);
      }
    }

    await this.sendMessengerNotifications(input);
    await this.sendPushNotification(input);

    return response;
  }

  /**
   * CHAT_MESSAGE: email только если offline + прошло окно throttle.
   * Остальные типы — без доп. ограничений.
   * Возвращает null, если письмо слать не нужно.
   */
  private async prepareEmailInput(
    input: NotifyInput
  ): Promise<NotifyInput | null> {
    if (input.type !== NotificationType.CHAT_MESSAGE) {
      return input;
    }

    if (await this.notificationsGateway.isUserConnected(input.recipientId)) {
      return null;
    }

    const conversationId =
      input.payload.conversationId ??
      (input.payload.entityType === 'conversation'
        ? input.payload.entityId
        : undefined);

    if (!conversationId) {
      return input;
    }

    const decision = await this.chatEmailThrottle.decide(
      input.recipientId,
      conversationId
    );

    if (!decision.send) {
      return null;
    }

    if (decision.messageCount > 1) {
      return {
        ...input,
        title: 'Новые сообщения в чате',
        body: `У вас ${decision.messageCount} новых сообщений в чате`,
      };
    }

    return input;
  }

  async list(user: AuthUser, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      recipientId: user.userId,
      ...(query.type !== undefined && { type: query.type }),
      ...(query.read === true && { readAt: { not: null } }),
      ...(query.read === false && { readAt: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: notificationInclude,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map(item => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async getUnreadCount(user: AuthUser) {
    const count = await this.countUnread(user.userId);
    return { count };
  }

  async markRead(user: AuthUser, id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: notificationInclude,
    });

    if (!notification) {
      throw new NotFoundException('Уведомление не найдено');
    }

    if (notification.recipientId !== user.userId) {
      throw new ForbiddenException('Нет доступа к уведомлению');
    }

    if (notification.readAt !== null) {
      return this.toResponse(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      include: notificationInclude,
    });

    return this.toResponse(updated);
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: user.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  private async countUnread(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        recipientId,
        readAt: null,
      },
    });
  }

  private async sendMessengerNotifications(input: NotifyInput): Promise<void> {
    if (!EMAIL_ENABLED_NOTIFICATION_TYPES.has(input.type)) {
      return;
    }

    const messengerInput = await this.prepareEmailInput(input);
    if (!messengerInput) {
      return;
    }

    const text = this.buildMessengerText(messengerInput);
    const providers: {
      provider: MessengerProvider;
      enabled: (userId: string, type: NotificationType) => Promise<boolean>;
    }[] = [
      {
        provider: MessengerProvider.TELEGRAM,
        enabled: (userId, type) =>
          this.userConfigService.isTelegramEnabled(userId, type),
      },
      {
        provider: MessengerProvider.MAX,
        enabled: (userId, type) =>
          this.userConfigService.isMaxEnabled(userId, type),
      },
    ];

    for (const item of providers) {
      try {
        const allowed = await item.enabled(
          messengerInput.recipientId,
          messengerInput.type
        );
        if (!allowed) {
          continue;
        }

        await this.messengerDelivery.sendToUser({
          userId: messengerInput.recipientId,
          provider: item.provider,
          text,
        });
      } catch (error) {
        this.logger.error(
          `Не удалось отправить ${item.provider}-уведомление (${messengerInput.type})`,
          error
        );
      }
    }
  }

  /**
   * Push использует те же типы, что in-app. CHAT_MESSAGE — только если offline.
   */
  private async sendPushNotification(input: NotifyInput): Promise<void> {
    try {
      const pushAllowed = await this.userConfigService.isInAppEnabled(
        input.recipientId,
        input.type
      );
      if (!pushAllowed) {
        return;
      }

      if (input.type === NotificationType.CHAT_MESSAGE) {
        if (await this.notificationsGateway.isUserConnected(input.recipientId)) {
          return;
        }
      }

      await this.pushService.sendToUser(input.recipientId, {
        title: input.title,
        body: input.body,
        notificationPayload: input.payload,
        type: input.type,
        actorId: input.actorId,
      });
    } catch (error) {
      this.logger.error(
        `Не удалось отправить push-уведомление (${input.type})`,
        error
      );
    }
  }

  private buildMessengerText(input: NotifyInput): string {
    const frontendUrl = this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
    const actionUrl = buildNotificationActionUrl(frontendUrl, input.payload, {
      type: input.type,
      actorId: input.actorId,
    });
    const parts = [input.title];

    if (input.body) {
      parts.push(input.body);
    }

    parts.push(actionUrl);
    return parts.join('\n\n');
  }

  private async sendEmailNotification(
    recipientId: string,
    input: NotifyInput
  ): Promise<void> {
    try {
      const email = await this.resolveRecipientEmail(recipientId);

      if (!email) {
        this.logger.warn(
          `Email не найден для получателя уведомления ${recipientId}`
        );
        return;
      }

      const frontendUrl = this.configService
        .getOrThrow<string>('FRONTEND_URL')
        .replace(/\/$/, '');
      const actionUrl = buildNotificationActionUrl(frontendUrl, input.payload, {
        type: input.type,
        actorId: input.actorId,
      });

      await this.mailService.sendNotificationEmail(email, {
        title: input.title,
        body: input.body,
        actionUrl,
      });
    } catch (error) {
      this.logger.error(
        `Не удалось отправить email-уведомление (${input.type})`,
        error
      );
    }
  }

  private async resolveRecipientEmail(
    recipientId: string
  ): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });

    const userEmail = user?.email?.trim();
    if (userEmail) {
      return userEmail;
    }

    const memberships = await this.prisma.accountMembership.findMany({
      where: { userId: recipientId },
      include: {
        account: {
          select: { email: true },
        },
      },
    });

    const ownerMembership = memberships.find(
      membership => membership.role === MembershipRole.OWNER
    );

    const accountEmail =
      ownerMembership?.account.email?.trim() ||
      memberships.find(membership => membership.account.email?.trim())?.account
        .email?.trim();

    return accountEmail || null;
  }

  private toResponse(
    notification: NotificationWithActor
  ): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload as NotificationPayload,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      actor: notification.actor
        ? this.mapActor(notification.actor)
        : null,
      actorAccountId: notification.actorAccountId ?? null,
      actorDisplayName: notification.actorDisplayName ?? null,
      actorKind: notification.actorKind ?? null,
    };
  }

  private mapActor(user: {
    id: string;
    role: Role;
    avatar: string | null;
    creatorProfile: { name: string; lastName: string } | null;
    companyProfile: { companyName: string } | null;
  }): NotificationActorDto {
    const base: NotificationActorDto = {
      id: user.id,
      role: user.role,
      avatar: user.avatar,
    };

    if (user.role === Role.CREATOR && user.creatorProfile) {
      return {
        ...base,
        name: user.creatorProfile.name,
        lastName: user.creatorProfile.lastName,
      };
    }

    if (user.role === Role.COMPANY && user.companyProfile) {
      return {
        ...base,
        companyName: user.companyProfile.companyName,
      };
    }

    return base;
  }
}
