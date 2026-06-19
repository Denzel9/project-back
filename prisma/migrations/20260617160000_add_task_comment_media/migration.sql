-- CreateTable
CREATE TABLE "TaskCommentMedia" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCommentMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskCommentMedia_commentId_idx" ON "TaskCommentMedia"("commentId");

-- AddForeignKey
ALTER TABLE "TaskCommentMedia" ADD CONSTRAINT "TaskCommentMedia_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "TaskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
