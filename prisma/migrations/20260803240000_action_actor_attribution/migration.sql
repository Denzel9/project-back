-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "actorAccountId" TEXT,
ADD COLUMN "actorDisplayName" TEXT,
ADD COLUMN "actorKind" "MessageActorKind";

-- AlterTable
ALTER TABLE "PostApplication" ADD COLUMN "createdActorAccountId" TEXT,
ADD COLUMN "createdActorDisplayName" TEXT,
ADD COLUMN "createdActorKind" "MessageActorKind",
ADD COLUMN "lastActorAccountId" TEXT,
ADD COLUMN "lastActorDisplayName" TEXT,
ADD COLUMN "lastActorKind" "MessageActorKind";

-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN "actorAccountId" TEXT,
ADD COLUMN "actorDisplayName" TEXT,
ADD COLUMN "actorKind" "MessageActorKind";

-- AlterTable
ALTER TABLE "TaskActivity" ADD COLUMN "actorAccountId" TEXT,
ADD COLUMN "actorDisplayName" TEXT,
ADD COLUMN "actorKind" "MessageActorKind";

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostApplication" ADD CONSTRAINT "PostApplication_createdActorAccountId_fkey" FOREIGN KEY ("createdActorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostApplication" ADD CONSTRAINT "PostApplication_lastActorAccountId_fkey" FOREIGN KEY ("lastActorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Notification_actorAccountId_idx" ON "Notification"("actorAccountId");

CREATE INDEX "PostApplication_createdActorAccountId_idx" ON "PostApplication"("createdActorAccountId");

CREATE INDEX "PostApplication_lastActorAccountId_idx" ON "PostApplication"("lastActorAccountId");

CREATE INDEX "TaskComment_actorAccountId_idx" ON "TaskComment"("actorAccountId");

CREATE INDEX "TaskActivity_actorAccountId_idx" ON "TaskActivity"("actorAccountId");
