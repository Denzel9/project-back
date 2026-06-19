-- CreateEnum
CREATE TYPE "TaskMediaKind" AS ENUM ('MAIN', 'REPORT');

-- AlterTable
ALTER TABLE "TaskMedia" ADD COLUMN "kind" "TaskMediaKind" NOT NULL DEFAULT 'MAIN';

-- CreateIndex
CREATE INDEX "TaskMedia_taskId_kind_idx" ON "TaskMedia"("taskId", "kind");
