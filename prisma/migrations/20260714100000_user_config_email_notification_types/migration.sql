-- AlterTable
ALTER TABLE "UserConfig"
ADD COLUMN "emailNotificationTypes" "NotificationType"[] NOT NULL DEFAULT ARRAY[
  'APPLICATION_NEW'::"NotificationType",
  'APPLICATION_STATUS_CHANGED'::"NotificationType",
  'APPLICATION_WITHDRAWN'::"NotificationType",
  'TASK_CREATED'::"NotificationType",
  'TASK_STATUS_CHANGED'::"NotificationType",
  'TASK_EXECUTOR_ASSIGNED'::"NotificationType",
  'TASK_COMMENT_CREATED'::"NotificationType",
  'TASK_MEDIA_ADDED'::"NotificationType",
  'CHAT_MESSAGE'::"NotificationType",
  'TEAM_INVITE'::"NotificationType",
  'MEMBERSHIP_REVOKED'::"NotificationType",
  'PUBLICATION_CREATED'::"NotificationType"
]::"NotificationType"[];
