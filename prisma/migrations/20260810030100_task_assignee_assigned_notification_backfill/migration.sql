-- Backfill: enable assignee notifications for existing user configs
UPDATE "UserConfig"
SET
  "inAppNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "inAppNotificationTypes" || ARRAY['TASK_ASSIGNEE_ASSIGNED'::"NotificationType"]
    )
  ),
  "emailNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "emailNotificationTypes" || ARRAY['TASK_ASSIGNEE_ASSIGNED'::"NotificationType"]
    )
  ),
  "telegramNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "telegramNotificationTypes" || ARRAY['TASK_ASSIGNEE_ASSIGNED'::"NotificationType"]
    )
  ),
  "maxNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "maxNotificationTypes" || ARRAY['TASK_ASSIGNEE_ASSIGNED'::"NotificationType"]
    )
  );
