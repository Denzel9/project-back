-- CreateEnum
CREATE TYPE "PrimeStatus" AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'CANCELED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "primeStatus" "PrimeStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Account" ADD COLUMN "primeExpiresAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "primeStartedAt" TIMESTAMP(3);
