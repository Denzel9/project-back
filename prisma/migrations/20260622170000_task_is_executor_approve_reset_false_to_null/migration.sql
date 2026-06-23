-- Reset backfilled default false values to null
UPDATE "Task" SET "isExecutorApprove" = NULL WHERE "isExecutorApprove" = false;
