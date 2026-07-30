-- AlterEnum
-- Must be committed before CANCELLED can be used in DML (separate migration for backfill).
ALTER TYPE "DashboardTileType" ADD VALUE IF NOT EXISTS 'CANCELLED';
