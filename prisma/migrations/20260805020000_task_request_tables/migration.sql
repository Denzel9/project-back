-- CreateEnum
CREATE TYPE "TaskRequestInitiator" AS ENUM ('CUSTOMER', 'EXECUTOR', 'MUTUAL');

-- CreateEnum
CREATE TYPE "TaskRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum TaskActivityType
ALTER TYPE "TaskActivityType" ADD VALUE 'ANNULMENT_REQUESTED';
ALTER TYPE "TaskActivityType" ADD VALUE 'ANNULMENT_CONFIRMED';
ALTER TYPE "TaskActivityType" ADD VALUE 'ANNULMENT_REJECTED';
ALTER TYPE "TaskActivityType" ADD VALUE 'DEADLINE_EXTENSION_REQUESTED';
ALTER TYPE "TaskActivityType" ADD VALUE 'DEADLINE_EXTENSION_CONFIRMED';
ALTER TYPE "TaskActivityType" ADD VALUE 'DEADLINE_EXTENSION_REJECTED';

-- CreateTable
CREATE TABLE "TaskAnnulmentRequest" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiator" "TaskRequestInitiator" NOT NULL,
    "status" "TaskRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAnnulmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDeadlineExtensionRequest" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "initiator" "TaskRequestInitiator" NOT NULL,
    "status" "TaskRequestStatus" NOT NULL DEFAULT 'PENDING',
    "proposedFinalDate" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDeadlineExtensionRequest_pkey" PRIMARY KEY ("id")
);

-- Migrate existing annulment JSON
INSERT INTO "TaskAnnulmentRequest" (
  "id", "taskId", "reason", "initiator", "status",
  "requestedById", "requestedAt", "confirmedById", "confirmedAt",
  "createdAt", "updatedAt"
)
SELECT
  COALESCE(NULLIF(a."annulment"->>'id', ''), gen_random_uuid()::text),
  a."id",
  COALESCE(NULLIF(a."annulment"->>'reason', ''), 'Миграция'),
  CASE
    WHEN a."annulment"->>'initiator' IN ('CUSTOMER', 'EXECUTOR', 'MUTUAL')
      THEN (a."annulment"->>'initiator')::"TaskRequestInitiator"
    ELSE 'CUSTOMER'::"TaskRequestInitiator"
  END,
  CASE
    WHEN a."annulment"->>'status' IN ('PENDING', 'CONFIRMED', 'REJECTED')
      THEN (a."annulment"->>'status')::"TaskRequestStatus"
    ELSE 'CONFIRMED'::"TaskRequestStatus"
  END,
  COALESCE(NULLIF(a."annulment"->>'requestedById', ''), a."ownerId"),
  COALESCE(
    NULLIF(a."annulment"->>'requestedAt', '')::timestamp,
    a."updatedAt"
  ),
  NULLIF(a."annulment"->>'confirmedById', ''),
  NULLIF(a."annulment"->>'confirmedAt', '')::timestamp,
  a."updatedAt",
  a."updatedAt"
FROM "Task" a
WHERE a."annulment" IS NOT NULL
  AND jsonb_typeof(a."annulment") = 'object';

-- Migrate existing deadlineExtension JSON
INSERT INTO "TaskDeadlineExtensionRequest" (
  "id", "taskId", "reason", "initiator", "status", "proposedFinalDate",
  "requestedById", "requestedAt", "confirmedById", "confirmedAt",
  "createdAt", "updatedAt"
)
SELECT
  COALESCE(NULLIF(t."deadlineExtension"->>'id', ''), gen_random_uuid()::text),
  t."id",
  COALESCE(NULLIF(t."deadlineExtension"->>'reason', ''), 'Миграция'),
  CASE
    WHEN t."deadlineExtension"->>'initiator' IN ('CUSTOMER', 'EXECUTOR', 'MUTUAL')
      THEN (t."deadlineExtension"->>'initiator')::"TaskRequestInitiator"
    ELSE 'CUSTOMER'::"TaskRequestInitiator"
  END,
  CASE
    WHEN t."deadlineExtension"->>'status' IN ('PENDING', 'CONFIRMED', 'REJECTED')
      THEN (t."deadlineExtension"->>'status')::"TaskRequestStatus"
    ELSE 'PENDING'::"TaskRequestStatus"
  END,
  COALESCE(
    NULLIF(t."deadlineExtension"->>'proposedFinalDate', '')::timestamp,
    t."finalDate",
    t."updatedAt"
  ),
  COALESCE(NULLIF(t."deadlineExtension"->>'requestedById', ''), t."ownerId"),
  COALESCE(
    NULLIF(t."deadlineExtension"->>'requestedAt', '')::timestamp,
    t."updatedAt"
  ),
  NULLIF(t."deadlineExtension"->>'confirmedById', ''),
  NULLIF(t."deadlineExtension"->>'confirmedAt', '')::timestamp,
  t."updatedAt",
  t."updatedAt"
FROM "Task" t
WHERE t."deadlineExtension" IS NOT NULL
  AND jsonb_typeof(t."deadlineExtension") = 'object';

-- CreateIndex
CREATE INDEX "TaskAnnulmentRequest_taskId_idx" ON "TaskAnnulmentRequest"("taskId");
CREATE INDEX "TaskAnnulmentRequest_taskId_status_idx" ON "TaskAnnulmentRequest"("taskId", "status");
CREATE INDEX "TaskAnnulmentRequest_requestedById_idx" ON "TaskAnnulmentRequest"("requestedById");

CREATE INDEX "TaskDeadlineExtensionRequest_taskId_idx" ON "TaskDeadlineExtensionRequest"("taskId");
CREATE INDEX "TaskDeadlineExtensionRequest_taskId_status_idx" ON "TaskDeadlineExtensionRequest"("taskId", "status");
CREATE INDEX "TaskDeadlineExtensionRequest_requestedById_idx" ON "TaskDeadlineExtensionRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "TaskAnnulmentRequest"
  ADD CONSTRAINT "TaskAnnulmentRequest_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAnnulmentRequest"
  ADD CONSTRAINT "TaskAnnulmentRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAnnulmentRequest"
  ADD CONSTRAINT "TaskAnnulmentRequest_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskDeadlineExtensionRequest"
  ADD CONSTRAINT "TaskDeadlineExtensionRequest_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDeadlineExtensionRequest"
  ADD CONSTRAINT "TaskDeadlineExtensionRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDeadlineExtensionRequest"
  ADD CONSTRAINT "TaskDeadlineExtensionRequest_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy JSON columns
ALTER TABLE "Task" DROP COLUMN IF EXISTS "annulment";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "deadlineExtension";
