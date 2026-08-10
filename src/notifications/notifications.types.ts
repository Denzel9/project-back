import { NotificationType, Prisma } from '@prisma/client';
import { NotificationPayload } from './notification-payload.types';

export type NotifyInput = {
  recipientId: string;
  actorId?: string | null;
  /** Account-level actor snapshot (manager vs owner) */
  actor?: {
    accountId: string;
    displayName: string;
    kind: 'OWNER' | 'MANAGER';
  } | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  payload: NotificationPayload;
  sendEmail?: boolean;
};

export const notificationInclude = {
  actor: {
    include: {
      creatorProfile: true,
      companyProfile: true,
    },
  },
} satisfies Prisma.NotificationInclude;

export type NotificationWithActor = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

export const EMAIL_ENABLED_NOTIFICATION_TYPES = new Set<NotificationType>([
  NotificationType.APPLICATION_NEW,
  NotificationType.APPLICATION_STATUS_CHANGED,
  NotificationType.APPLICATION_WITHDRAWN,
  NotificationType.TASK_CREATED,
  NotificationType.TASK_STATUS_CHANGED,
  NotificationType.TASK_EXECUTOR_ASSIGNED,
  NotificationType.TASK_ASSIGNEE_ASSIGNED,
  NotificationType.TASK_COMMENT_CREATED,
  NotificationType.TASK_MEDIA_ADDED,
  NotificationType.TASK_DEADLINE_SOON,
  NotificationType.TASK_DEADLINE_TODAY,
  NotificationType.TASK_DEADLINE_OVERDUE,
  NotificationType.CHAT_MESSAGE,
  NotificationType.TEAM_INVITE,
  NotificationType.MEMBERSHIP_REVOKED,
  NotificationType.PUBLICATION_CREATED,
]);
