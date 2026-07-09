import { NotificationEntityType, NotificationPayload } from './notification-payload.types';

export function buildNotificationActionUrl(
  frontendUrl: string,
  payload: NotificationPayload
): string {
  const base = frontendUrl.replace(/\/$/, '');

  switch (payload.entityType) {
    case 'application':
      return `${base}/applications/incoming`;
    case 'task':
      return `${base}/tasks/${payload.entityId}`;
    case 'conversation':
      return `${base}/chat/${payload.entityId}`;
    case 'invite':
      return `${base}/invites/accept`;
    case 'publication':
      return `${base}/publications/${payload.entityId}`;
    default:
      return base;
  }
}
