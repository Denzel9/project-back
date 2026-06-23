-- AlterTable
ALTER TABLE "Post" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Post_isPrivate_idx" ON "Post"("isPrivate");

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "applicationId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Task_postId_executorId_key" ON "Task"("postId", "executorId");

-- CreateIndex
CREATE INDEX "Task_postId_idx" ON "Task"("postId");
