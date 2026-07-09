import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipRole, NotificationType, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly notificationsGateway: NotificationsGateway
  ) {}

  async notify(input: NotifyInput): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        payload: input.payload as Prisma.InputJsonValue,
      },
      include: notificationInclude,
    });

    const unreadCount = await this.countUnread(input.recipientId);
    const response = this.toResponse(notification);

    this.notificationsGateway.broadcastNotification(
      input.recipientId,
      response,
      unreadCount
    );

    const shouldSendEmail =
      input.sendEmail !== false &&
      EMAIL_ENABLED_NOTIFICATION_TYPES.has(input.type);

    if (shouldSendEmail) {
      await this.sendEmailNotification(input.recipientId, input);
    }

    return response;
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

  private async sendEmailNotification(
    recipientId: string,
    input: NotifyInput
  ): Promise<void> {
    try {
      const email = await this.resolveRecipientEmail(recipientId);

      if (!email) {
        this.logger.warn(
          `Email OWNER не найден для получателя уведомления ${recipientId}`
        );
        return;
      }

      const frontendUrl = this.configService
        .getOrThrow<string>('FRONTEND_URL')
        .replace(/\/$/, '');
      const actionUrl = buildNotificationActionUrl(frontendUrl, input.payload);

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
    const ownerMembership = await this.prisma.accountMembership.findFirst({
      where: {
        userId: recipientId,
        role: MembershipRole.OWNER,
      },
      include: {
        account: {
          select: { email: true },
        },
      },
    });

    return ownerMembership?.account.email ?? null;
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
