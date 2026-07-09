export type NotificationEntityType =
  | 'application'
  | 'task'
  | 'conversation'
  | 'invite'
  | 'publication';

export type NotificationPayload = {
  entityType: NotificationEntityType;
  entityId: string;
  postId?: string;
  taskId?: string;
  conversationId?: string;
  applicationId?: string;
  meta?: Record<string, unknown>;
};
