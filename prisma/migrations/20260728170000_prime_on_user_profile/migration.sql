-- AlterTable: move Prime subscription from Account to User (per profile)
ALTER TABLE "User" ADD COLUMN "primeStatus" "PrimeStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN "primeExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "primeStartedAt" TIMESTAMP(3);

-- Copy existing Account-level Prime onto all member profiles of that Account
UPDATE "User" AS u
SET
  "primeStatus" = a."primeStatus",
  "primeExpiresAt" = a."primeExpiresAt",
  "primeStartedAt" = a."primeStartedAt"
FROM "AccountMembership" AS m
INNER JOIN "Account" AS a ON a."id" = m."accountId"
WHERE m."userId" = u."id"
  AND a."primeStatus" <> 'NONE';

ALTER TABLE "Account" DROP COLUMN "primeStatus";
ALTER TABLE "Account" DROP COLUMN "primeExpiresAt";
ALTER TABLE "Account" DROP COLUMN "primeStartedAt";
