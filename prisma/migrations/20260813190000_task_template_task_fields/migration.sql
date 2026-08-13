-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN "finalDate" TIMESTAMP(3);
ALTER TABLE "TaskTemplate" ADD COLUMN "location" JSONB;
ALTER TABLE "TaskTemplate" ADD COLUMN "bloggerRequirements" JSONB;
ALTER TABLE "TaskTemplate" ADD COLUMN "cooperationDetails" JSONB;
