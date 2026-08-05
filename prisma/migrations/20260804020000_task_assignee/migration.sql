-- AlterTable
ALTER TABLE "Task" ADD COLUMN "assigneeAccountId" TEXT,
ADD COLUMN "assigneeDisplayName" TEXT,
ADD COLUMN "assigneeKind" "MessageActorKind";

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeAccountId_fkey" FOREIGN KEY ("assigneeAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Task_assigneeAccountId_idx" ON "Task"("assigneeAccountId");
