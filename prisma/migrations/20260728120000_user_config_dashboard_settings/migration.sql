-- CreateEnum
CREATE TYPE "DashboardTileType" AS ENUM (
  'PENDING_ACTION',
  'PENDING_EXECUTOR_ASSIGN',
  'NO_EXECUTOR_ASSIGN',
  'OVERDUE',
  'URGENT',
  'CHECKING'
);

-- AlterTable
ALTER TABLE "UserConfig"
ADD COLUMN "dashboardTiles" "DashboardTileType"[] NOT NULL DEFAULT ARRAY[
  'PENDING_ACTION'::"DashboardTileType",
  'PENDING_EXECUTOR_ASSIGN'::"DashboardTileType",
  'NO_EXECUTOR_ASSIGN'::"DashboardTileType",
  'OVERDUE'::"DashboardTileType",
  'URGENT'::"DashboardTileType",
  'CHECKING'::"DashboardTileType"
]::"DashboardTileType"[],
ADD COLUMN "dashboardShowTasks" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowCalendar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dashboardShowChats" BOOLEAN NOT NULL DEFAULT true;
