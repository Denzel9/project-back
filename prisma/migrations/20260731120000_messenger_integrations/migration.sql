-- CreateEnum
CREATE TYPE "MessengerProvider" AS ENUM ('TELEGRAM', 'MAX');

-- CreateEnum
CREATE TYPE "MessengerConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "UserConfig"
ADD COLUMN "telegramNotificationTypes" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[],
ADD COLUMN "maxNotificationTypes" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[];

-- Backfill messenger prefs from email whitelist
UPDATE "UserConfig"
SET
  "telegramNotificationTypes" = "emailNotificationTypes",
  "maxNotificationTypes" = "emailNotificationTypes";

-- CreateTable
CREATE TABLE "MessengerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MessengerProvider" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "status" "MessengerConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessengerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessengerLinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MessengerProvider" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessengerLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessengerConnection_userId_idx" ON "MessengerConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessengerConnection_userId_provider_key" ON "MessengerConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "MessengerConnection_provider_chatId_key" ON "MessengerConnection"("provider", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "MessengerLinkToken_token_key" ON "MessengerLinkToken"("token");

-- CreateIndex
CREATE INDEX "MessengerLinkToken_userId_provider_idx" ON "MessengerLinkToken"("userId", "provider");

-- CreateIndex
CREATE INDEX "MessengerLinkToken_expiresAt_idx" ON "MessengerLinkToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "MessengerConnection" ADD CONSTRAINT "MessengerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessengerLinkToken" ADD CONSTRAINT "MessengerLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
