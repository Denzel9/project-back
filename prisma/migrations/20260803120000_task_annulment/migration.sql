-- TaskStatus: CANCELLED / CANCELLED_EXECUTOR → ANNULLED + annulment JSON

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "annulment" JSONB;

CREATE TYPE "TaskStatus_new" AS ENUM (
  'PREPARING',
  'PENDING_APPROVAL',
  'IN_PROGRESS',
  'CHECKING',
  'REVISION',
  'COMPLETED',
  'ANNULLED'
);

ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "Task"
SET
  "annulment" = jsonb_build_object(
    'id', gen_random_uuid()::text,
    'reason', 'Миграция',
    'initiator', 'CUSTOMER',
    'requestedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'requestedById', "ownerId",
    'status', 'CONFIRMED',
    'confirmedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'confirmedById', "ownerId"
  )
WHERE "status"::text = 'CANCELLED'
  AND "annulment" IS NULL;

UPDATE "Task"
SET
  "annulment" = jsonb_build_object(
    'id', gen_random_uuid()::text,
    'reason', 'Миграция',
    'initiator', 'EXECUTOR',
    'requestedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'requestedById', COALESCE("executorId", "ownerId"),
    'status', 'CONFIRMED',
    'confirmedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'confirmedById', COALESCE("executorId", "ownerId")
  )
WHERE "status"::text = 'CANCELLED_EXECUTOR'
  AND "annulment" IS NULL;

ALTER TABLE "Task"
  ALTER COLUMN "status" TYPE "TaskStatus_new"
  USING (
    CASE
      WHEN "status"::text IN ('CANCELLED', 'CANCELLED_EXECUTOR') THEN 'ANNULLED'::"TaskStatus_new"
      ELSE "status"::text::"TaskStatus_new"
    END
  );

DROP TYPE "TaskStatus";

ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";

ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PREPARING'::"TaskStatus";
