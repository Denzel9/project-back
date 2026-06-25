-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TELEGRAM', 'VK', 'OTHER');

-- CreateEnum
CREATE TYPE "PlacementFormat" AS ENUM ('POST', 'STORIES', 'REELS', 'SHORTS', 'INTEGRATION', 'LIVE');

-- CreateEnum
CREATE TYPE "WorkFormat" AS ENUM ('REMOTE', 'ON_SITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FIXED', 'RANGE', 'NEGOTIABLE', 'BARTER');

-- CreateEnum
CREATE TYPE "PostCurrency" AS ENUM ('RUB', 'USD');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('PREPAY', 'POSTPAY', '50_50', 'SAFE_DEAL');

-- CreateEnum
CREATE TYPE "ContentStyle" AS ENUM ('LIFESTYLE', 'REVIEW', 'HUMOR', 'EXPERT', 'UGC', 'UNBOXING', 'TUTORIAL', 'VLOG', 'STORYTELLING', 'BEFORE_AFTER', 'CHALLENGE', 'BUYING', 'PODCAST', 'INTERVIEW', 'ASMR', 'EDUCATIONAL', 'SPORTS');

-- CreateEnum
CREATE TYPE "UsageRights" AS ENUM ('ORGANIC_ONLY', 'PAID_ADS', 'FULL_LICENSE');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "platforms" "Platform"[] DEFAULT ARRAY[]::"Platform"[],
ADD COLUMN "placementFormats" "PlacementFormat"[] DEFAULT ARRAY[]::"PlacementFormat"[],
ADD COLUMN "niche" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "budget" JSONB,
ADD COLUMN "deadline" TIMESTAMP(3),
ADD COLUMN "workFormat" "WorkFormat",
ADD COLUMN "location" JSONB,
ADD COLUMN "bloggerRequirements" JSONB,
ADD COLUMN "cooperationDetails" JSONB,
ADD COLUMN "brief" JSONB,
ADD COLUMN "deliverables" JSONB;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "typeCooperation",
DROP COLUMN "contentType";

-- DropEnum
DROP TYPE "TypeCooperation";

-- DropEnum
DROP TYPE "PostContentType";
