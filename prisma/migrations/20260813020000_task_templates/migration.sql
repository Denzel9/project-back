-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "photoCount" TEXT NOT NULL DEFAULT '0',
    "videoCount" TEXT NOT NULL DEFAULT '0',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "brief" JSONB,
    "deliverables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskTemplate_ownerId_idx" ON "TaskTemplate"("ownerId");

-- CreateIndex
CREATE INDEX "TaskTemplate_ownerId_updatedAt_idx" ON "TaskTemplate"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
