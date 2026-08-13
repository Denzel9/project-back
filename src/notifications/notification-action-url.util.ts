import { NotificationType } from '@prisma/client';
import { NotificationPayload } from './notification-payload.types';

export type BuildNotificationActionUrlOptions = {
  type?: NotificationType;
  actorId?: string | null;
};

function getPeerId(
  payload: NotificationPayload,
  actorId?: string | null
): string | undefined {
  return payload.peerId ?? payload.senderId ?? actorId ?? undefined;
}

function getTaskPath(payload: NotificationPayload): string {
  const taskId = payload.taskId ?? payload.entityId;
  const postId = payload.postId;

  if (taskId && postId) {
    return `/task/${postId}?taskId=${encodeURIComponent(taskId)}`;
  }

  if (taskId) {
    return `/task/${taskId}?taskId=${encodeURIComponent(taskId)}`;
  }

  if (postId) {
    return `/task/${postId}`;
  }

  return '/';
}

/**
 * Paths must match frontend `getNotificationLink` / React Router routes.
 */
export function buildNotificationActionUrl(
  frontendUrl: string,
  payload: NotificationPayload,
  options: BuildNotificationActionUrlOptions = {}
): string {
  const base = frontendUrl.replace(/\/$/, '');
  const { type, actorId } = options;

  if (type) {
    switch (type) {
      case NotificationType.APPLICATION_NEW: {
        const params = new URLSearchParams();
        params.set('status', 'NEW');
        if (payload.postId) {
          params.set('postId', payload.postId);
        }
        return `${base}/posts-responses?${params.toString()}`;
      }

      case NotificationType.APPLICATION_STATUS_CHANGED:
      case NotificationType.APPLICATION_WITHDRAWN:
        if (payload.postId) {
          return `${base}/post/${payload.postId}`;
        }
        return `${base}/posts-responses`;

      case NotificationType.TASK_CREATED:
      case NotificationType.TASK_STATUS_CHANGED:
      case NotificationType.TASK_EXECUTOR_ASSIGNED:
      case NotificationType.TASK_ASSIGNEE_ASSIGNED:
      case NotificationType.TASK_COMMENT_CREATED:
      case NotificationType.TASK_MEDIA_ADDED:
      case NotificationType.TASK_DEADLINE_SOON:
      case NotificationType.TASK_DEADLINE_TODAY:
      case NotificationType.TASK_DEADLINE_OVERDUE:
        return `${base}${getTaskPath(payload)}`;

      case NotificationType.CHAT_MESSAGE: {
        const peerId = getPeerId(payload, actorId);
        return peerId
          ? `${base}/chat?recipientId=${encodeURIComponent(peerId)}`
          : `${base}/chat`;
      }

      case NotificationType.TEAM_INVITE: {
        const token = payload.inviteToken ?? payload.token;
        if (typeof token === 'string' && token) {
          return `${base}/invites/accept?token=${encodeURIComponent(token)}`;
        }
        return `${base}/settings/members`;
      }

      case NotificationType.MEMBERSHIP_REVOKED:
        return `${base}/settings/members`;

      case NotificationType.PUBLICATION_CREATED:
        return `${base}/crm/publications`;

      default:
        break;
    }
  }

  // Fallback by entityType when type is missing
  switch (payload.entityType) {
    case 'application':
      return `${base}/posts-responses`;
    case 'task':
      return `${base}${getTaskPath(payload)}`;
    case 'conversation': {
      const peerId = getPeerId(payload, actorId);
      return peerId
        ? `${base}/chat?recipientId=${encodeURIComponent(peerId)}`
        : `${base}/chat`;
    }
    case 'invite':
      return `${base}/settings/members`;
    case 'publication':
      return `${base}/crm/publications`;
    default:
      return base;
  }
}
