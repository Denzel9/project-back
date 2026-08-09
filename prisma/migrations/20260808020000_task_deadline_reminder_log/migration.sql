-- CreateTable
CREATE TABLE "DeadlineReminderLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "finalDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadlineReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeadlineReminderLog_sentAt_idx" ON "DeadlineReminderLog"("sentAt");

-- CreateIndex
CREATE INDEX "DeadlineReminderLog_recipientId_idx" ON "DeadlineReminderLog"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineReminderLog_taskId_recipientId_type_finalDate_key" ON "DeadlineReminderLog"("taskId", "recipientId", "type", "finalDate");

-- CreateIndex
CREATE INDEX "Task_finalDate_idx" ON "Task"("finalDate");

-- AddForeignKey
ALTER TABLE "DeadlineReminderLog" ADD CONSTRAINT "DeadlineReminderLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineReminderLog" ADD CONSTRAINT "DeadlineReminderLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: enable deadline reminder types for existing user configs
UPDATE "UserConfig"
SET
  "inAppNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "inAppNotificationTypes" || ARRAY[
        'TASK_DEADLINE_SOON'::"NotificationType",
        'TASK_DEADLINE_TODAY'::"NotificationType",
        'TASK_DEADLINE_OVERDUE'::"NotificationType"
      ]
    )
  ),
  "emailNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "emailNotificationTypes" || ARRAY[
        'TASK_DEADLINE_SOON'::"NotificationType",
        'TASK_DEADLINE_TODAY'::"NotificationType",
        'TASK_DEADLINE_OVERDUE'::"NotificationType"
      ]
    )
  ),
  "telegramNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "telegramNotificationTypes" || ARRAY[
        'TASK_DEADLINE_SOON'::"NotificationType",
        'TASK_DEADLINE_TODAY'::"NotificationType",
        'TASK_DEADLINE_OVERDUE'::"NotificationType"
      ]
    )
  ),
  "maxNotificationTypes" = ARRAY(
    SELECT DISTINCT unnest(
      "maxNotificationTypes" || ARRAY[
        'TASK_DEADLINE_SOON'::"NotificationType",
        'TASK_DEADLINE_TODAY'::"NotificationType",
        'TASK_DEADLINE_OVERDUE'::"NotificationType"
      ]
    )
  );
