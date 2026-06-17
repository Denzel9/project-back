-- CreateTable
CREATE TABLE "TaskMedia" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskMedia_taskId_idx" ON "TaskMedia"("taskId");

-- AddForeignKey
ALTER TABLE "TaskMedia" ADD CONSTRAINT "TaskMedia_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "media";
