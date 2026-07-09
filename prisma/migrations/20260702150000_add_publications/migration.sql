-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PUBLISHED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PUBLICATION_CREATED';

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "executorId" TEXT,
    "title" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "externalUrl" TEXT,
    "platform" "Platform",
    "brief" JSONB,
    "deliverables" JSONB,
    "location" JSONB,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationMedia" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "sourceTaskMediaId" TEXT,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Publication_taskId_key" ON "Publication"("taskId");

-- CreateIndex
CREATE INDEX "Publication_ownerId_idx" ON "Publication"("ownerId");

-- CreateIndex
CREATE INDEX "Publication_executorId_idx" ON "Publication"("executorId");

-- CreateIndex
CREATE INDEX "Publication_postId_idx" ON "Publication"("postId");

-- CreateIndex
CREATE INDEX "PublicationMedia_publicationId_idx" ON "PublicationMedia"("publicationId");

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationMedia" ADD CONSTRAINT "PublicationMedia_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
