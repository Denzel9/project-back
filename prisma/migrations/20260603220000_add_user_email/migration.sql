-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- Backfill from owner Account email
UPDATE "User" u
SET "email" = a."email"
FROM "AccountMembership" am
INNER JOIN "Account" a ON a."id" = am."accountId"
WHERE am."userId" = u."id" AND am."role" = 'OWNER';

-- Fallback: first linked account for users without OWNER membership
UPDATE "User" u
SET "email" = sub."email"
FROM (
  SELECT DISTINCT ON (am."userId") am."userId", a."email"
  FROM "AccountMembership" am
  INNER JOIN "Account" a ON a."id" = am."accountId"
  ORDER BY am."userId", am."createdAt" ASC
) sub
WHERE u."id" = sub."userId" AND u."email" IS NULL;

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
