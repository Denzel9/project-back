-- AlterTable
ALTER TABLE "User" ADD COLUMN "contacts" JSONB;

-- Backfill existing phone into contacts array
UPDATE "User"
SET "contacts" = jsonb_build_array(
  jsonb_build_object('type', 'phone', 'value', "phone")
)
WHERE "phone" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phone";
