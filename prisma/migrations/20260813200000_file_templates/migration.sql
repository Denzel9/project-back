-- CreateTable
CREATE TABLE "FileTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileTemplate_ownerId_idx" ON "FileTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "FileTemplate_ownerId_updatedAt_idx" ON "FileTemplate"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "FileTemplate" ADD CONSTRAINT "FileTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
