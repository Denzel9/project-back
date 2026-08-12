-- AlterTable
ALTER TABLE "Task" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Task_isArchived_idx" ON "Task"("isArchived");
