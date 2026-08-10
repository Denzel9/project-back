-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('STAFF', 'ONE_TIME');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "employmentType" "EmploymentType";
