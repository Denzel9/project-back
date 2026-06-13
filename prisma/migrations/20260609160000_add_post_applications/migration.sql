-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'VIEWED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "PostApplication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostApplication_postId_idx" ON "PostApplication"("postId");

-- CreateIndex
CREATE INDEX "PostApplication_applicantId_idx" ON "PostApplication"("applicantId");

-- CreateIndex
CREATE INDEX "PostApplication_status_idx" ON "PostApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PostApplication_postId_applicantId_key" ON "PostApplication"("postId", "applicantId");

-- AddForeignKey
ALTER TABLE "PostApplication" ADD CONSTRAINT "PostApplication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostApplication" ADD CONSTRAINT "PostApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
