-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ConversationParticipant" ADD COLUMN "pinnedAt" TIMESTAMP(3);
