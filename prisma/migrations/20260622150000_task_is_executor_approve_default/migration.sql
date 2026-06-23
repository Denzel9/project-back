-- Backfill existing NULL values
UPDATE "Task" SET "isExecutorApprove" = false WHERE "isExecutorApprove" IS NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "isExecutorApprove" SET DEFAULT false;
