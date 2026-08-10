-- CreateEnum
CREATE TYPE "MessagePinScope" AS ENUM ('PERSONAL', 'SHARED');

-- AlterTable
ALTER TABLE "MessagePin" ADD COLUMN "scope" "MessagePinScope" NOT NULL DEFAULT 'SHARED';

-- DropIndex
DROP INDEX "MessagePin_messageId_key";

-- CreateIndex
CREATE UNIQUE INDEX "MessagePin_messageId_pinnedById_key" ON "MessagePin"("messageId", "pinnedById");

-- CreateIndex
CREATE INDEX "MessagePin_messageId_idx" ON "MessagePin"("messageId");
