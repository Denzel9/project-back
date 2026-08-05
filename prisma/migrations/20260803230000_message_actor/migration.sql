-- AlterTable
CREATE TYPE "MessageActorKind" AS ENUM ('OWNER', 'MANAGER');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "actorAccountId" TEXT,
ADD COLUMN "actorDisplayName" TEXT,
ADD COLUMN "actorKind" "MessageActorKind";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Message_actorAccountId_idx" ON "Message"("actorAccountId");
