-- AlterTable
ALTER TABLE "Task" ADD COLUMN "location" JSONB,
ADD COLUMN "bloggerRequirements" JSONB,
ADD COLUMN "cooperationDetails" JSONB,
ADD COLUMN "brief" JSONB,
ADD COLUMN "deliverables" JSONB;
