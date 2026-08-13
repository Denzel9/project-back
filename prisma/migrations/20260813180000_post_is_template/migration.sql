-- AlterTable
ALTER TABLE "Post" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Post_isTemplate_idx" ON "Post"("isTemplate");
