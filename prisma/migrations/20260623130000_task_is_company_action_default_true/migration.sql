-- Backfill existing NULL values
UPDATE "Task" SET "isCompanyAction" = true WHERE "isCompanyAction" IS NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "isCompanyAction" SET DEFAULT true;
ALTER TABLE "Task" ALTER COLUMN "isCompanyAction" SET NOT NULL;
