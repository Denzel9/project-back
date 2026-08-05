-- Migrate EDITOR/VIEWER memberships and invites to ADMIN, then drop enum values.

UPDATE "AccountMembership"
SET "role" = 'ADMIN'
WHERE "role"::text IN ('EDITOR', 'VIEWER');

UPDATE "AccountInvite"
SET "role" = 'ADMIN'
WHERE "role"::text IN ('EDITOR', 'VIEWER');

CREATE TYPE "MembershipRole_new" AS ENUM ('OWNER', 'ADMIN');

ALTER TABLE "AccountMembership"
  ALTER COLUMN "role" TYPE "MembershipRole_new"
  USING ("role"::text::"MembershipRole_new");

ALTER TABLE "AccountInvite"
  ALTER COLUMN "role" TYPE "MembershipRole_new"
  USING ("role"::text::"MembershipRole_new");

DROP TYPE "MembershipRole";

ALTER TYPE "MembershipRole_new" RENAME TO "MembershipRole";
