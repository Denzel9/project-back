-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Backfill from first phone contact in contacts array
UPDATE "User" u
SET "phone" = (
  SELECT c->>'value'
  FROM jsonb_array_elements(u."contacts") AS c
  WHERE c->>'type' = 'phone'
  LIMIT 1
)
WHERE u."contacts" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(u."contacts") AS c
    WHERE c->>'type' = 'phone'
  );
