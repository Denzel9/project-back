-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('TEAM', 'CROSS');

-- AlterTable
ALTER TABLE "AccountInvite" ADD COLUMN "kind" "InviteKind" NOT NULL DEFAULT 'TEAM';
