-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN "replyToId" TEXT,
ADD COLUMN "replyToPreview" TEXT,
ADD COLUMN "replyToSenderId" TEXT,
ADD COLUMN "replyToSenderName" TEXT;

-- CreateIndex
CREATE INDEX "TaskComment_replyToId_idx" ON "TaskComment"("replyToId");

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "TaskComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TaskCommentPin" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinnedById" TEXT NOT NULL,

    CONSTRAINT "TaskCommentPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskCommentPin_commentId_key" ON "TaskCommentPin"("commentId");

-- CreateIndex
CREATE INDEX "TaskCommentPin_taskId_pinnedAt_idx" ON "TaskCommentPin"("taskId", "pinnedAt");

-- AddForeignKey
ALTER TABLE "TaskCommentPin" ADD CONSTRAINT "TaskCommentPin_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCommentPin" ADD CONSTRAINT "TaskCommentPin_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCommentPin" ADD CONSTRAINT "TaskCommentPin_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
