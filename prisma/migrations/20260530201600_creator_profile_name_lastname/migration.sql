-- AlterTable: migrate displayName to name + lastName
ALTER TABLE "CreatorProfile" ADD COLUMN "name" TEXT;
ALTER TABLE "CreatorProfile" ADD COLUMN "lastName" TEXT;

UPDATE "CreatorProfile"
SET "name" = "displayName", "lastName" = ''
WHERE "name" IS NULL;

ALTER TABLE "CreatorProfile" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "CreatorProfile" ALTER COLUMN "lastName" SET NOT NULL;

ALTER TABLE "CreatorProfile" DROP COLUMN "displayName";
