-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskCommentReadState" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "TaskCommentReadState_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateIndex
CREATE INDEX "TaskCommentReadState_userId_idx" ON "TaskCommentReadState"("userId");

-- AddForeignKey
ALTER TABLE "TaskCommentReadState" ADD CONSTRAINT "TaskCommentReadState_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCommentReadState" ADD CONSTRAINT "TaskCommentReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
