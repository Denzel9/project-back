-- Flatten bloggerRequirements / cooperationDetails JSON into columns on Post and Task

-- Post: add flat columns
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "minFollowers" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "maxFollowers" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "minEngagementRate" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "verifiedAccount" BOOLEAN;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "experienceWithAds" BOOLEAN;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "contentStyle" "ContentStyle"[] NOT NULL DEFAULT ARRAY[]::"ContentStyle"[];
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "exclusivity" BOOLEAN;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "exclusivityDays" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "usageRights" "UsageRights";
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "usageDurationDays" INTEGER;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "requiresMarking" BOOLEAN;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "requiresContract" BOOLEAN;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "ndaRequired" BOOLEAN;

-- Task: add flat columns
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "minFollowers" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "maxFollowers" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "minEngagementRate" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "verifiedAccount" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "experienceWithAds" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "contentStyle" "ContentStyle"[] NOT NULL DEFAULT ARRAY[]::"ContentStyle"[];
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "exclusivity" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "exclusivityDays" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "usageRights" "UsageRights";
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "usageDurationDays" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "requiresMarking" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "requiresContract" BOOLEAN;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "ndaRequired" BOOLEAN;

-- Migrate Post.bloggerRequirements
UPDATE "Post"
SET
  "minFollowers" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'minFollowers') = 'number'
    THEN ("bloggerRequirements"->>'minFollowers')::INTEGER
    ELSE NULL
  END,
  "maxFollowers" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'maxFollowers') = 'number'
    THEN ("bloggerRequirements"->>'maxFollowers')::INTEGER
    ELSE NULL
  END,
  "minEngagementRate" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'minEngagementRate') = 'number'
    THEN ("bloggerRequirements"->>'minEngagementRate')::DOUBLE PRECISION
    ELSE NULL
  END,
  "verifiedAccount" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'verifiedAccount') = 'boolean'
    THEN ("bloggerRequirements"->>'verifiedAccount')::BOOLEAN
    ELSE NULL
  END,
  "experienceWithAds" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'experienceWithAds') = 'boolean'
    THEN ("bloggerRequirements"->>'experienceWithAds')::BOOLEAN
    ELSE NULL
  END,
  "languages" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'languages') = 'array'
    THEN COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text("bloggerRequirements"->'languages')
      ),
      ARRAY[]::TEXT[]
    )
    ELSE ARRAY[]::TEXT[]
  END,
  "contentStyle" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'contentStyle') = 'array'
    THEN COALESCE(
      (
        SELECT ARRAY_AGG(val::"ContentStyle")
        FROM jsonb_array_elements_text("bloggerRequirements"->'contentStyle') AS val
        WHERE val IN (
          SELECT unnest(enum_range(NULL::"ContentStyle")::TEXT[])
        )
      ),
      ARRAY[]::"ContentStyle"[]
    )
    ELSE ARRAY[]::"ContentStyle"[]
  END
WHERE "bloggerRequirements" IS NOT NULL
  AND jsonb_typeof("bloggerRequirements"::jsonb) = 'object';

-- Migrate Post.cooperationDetails only if it looks like cooperation (not blogger-shape)
UPDATE "Post"
SET
  "exclusivity" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'exclusivity') = 'boolean'
    THEN ("cooperationDetails"->>'exclusivity')::BOOLEAN
    ELSE NULL
  END,
  "exclusivityDays" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'exclusivityDays') = 'number'
    THEN ("cooperationDetails"->>'exclusivityDays')::INTEGER
    ELSE NULL
  END,
  "usageRights" = CASE
    WHEN "cooperationDetails"->>'usageRights' IN (
      SELECT unnest(enum_range(NULL::"UsageRights")::TEXT[])
    )
    THEN ("cooperationDetails"->>'usageRights')::"UsageRights"
    ELSE NULL
  END,
  "usageDurationDays" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'usageDurationDays') = 'number'
    THEN ("cooperationDetails"->>'usageDurationDays')::INTEGER
    ELSE NULL
  END,
  "requiresMarking" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'requiresMarking') = 'boolean'
    THEN ("cooperationDetails"->>'requiresMarking')::BOOLEAN
    ELSE NULL
  END,
  "requiresContract" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'requiresContract') = 'boolean'
    THEN ("cooperationDetails"->>'requiresContract')::BOOLEAN
    ELSE NULL
  END,
  "ndaRequired" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'ndaRequired') = 'boolean'
    THEN ("cooperationDetails"->>'ndaRequired')::BOOLEAN
    ELSE NULL
  END
WHERE "cooperationDetails" IS NOT NULL
  AND jsonb_typeof("cooperationDetails"::jsonb) = 'object'
  AND NOT (
    "cooperationDetails"::jsonb ? 'minFollowers'
    OR "cooperationDetails"::jsonb ? 'maxFollowers'
    OR "cooperationDetails"::jsonb ? 'contentStyle'
    OR "cooperationDetails"::jsonb ? 'languages'
  );

-- Migrate Task.bloggerRequirements
UPDATE "Task"
SET
  "minFollowers" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'minFollowers') = 'number'
    THEN ("bloggerRequirements"->>'minFollowers')::INTEGER
    ELSE NULL
  END,
  "maxFollowers" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'maxFollowers') = 'number'
    THEN ("bloggerRequirements"->>'maxFollowers')::INTEGER
    ELSE NULL
  END,
  "minEngagementRate" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'minEngagementRate') = 'number'
    THEN ("bloggerRequirements"->>'minEngagementRate')::DOUBLE PRECISION
    ELSE NULL
  END,
  "verifiedAccount" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'verifiedAccount') = 'boolean'
    THEN ("bloggerRequirements"->>'verifiedAccount')::BOOLEAN
    ELSE NULL
  END,
  "experienceWithAds" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'experienceWithAds') = 'boolean'
    THEN ("bloggerRequirements"->>'experienceWithAds')::BOOLEAN
    ELSE NULL
  END,
  "languages" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'languages') = 'array'
    THEN COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text("bloggerRequirements"->'languages')
      ),
      ARRAY[]::TEXT[]
    )
    ELSE ARRAY[]::TEXT[]
  END,
  "contentStyle" = CASE
    WHEN jsonb_typeof("bloggerRequirements"->'contentStyle') = 'array'
    THEN COALESCE(
      (
        SELECT ARRAY_AGG(val::"ContentStyle")
        FROM jsonb_array_elements_text("bloggerRequirements"->'contentStyle') AS val
        WHERE val IN (
          SELECT unnest(enum_range(NULL::"ContentStyle")::TEXT[])
        )
      ),
      ARRAY[]::"ContentStyle"[]
    )
    ELSE ARRAY[]::"ContentStyle"[]
  END
WHERE "bloggerRequirements" IS NOT NULL
  AND jsonb_typeof("bloggerRequirements"::jsonb) = 'object';

-- Migrate Task.cooperationDetails (skip blogger-shape)
UPDATE "Task"
SET
  "exclusivity" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'exclusivity') = 'boolean'
    THEN ("cooperationDetails"->>'exclusivity')::BOOLEAN
    ELSE NULL
  END,
  "exclusivityDays" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'exclusivityDays') = 'number'
    THEN ("cooperationDetails"->>'exclusivityDays')::INTEGER
    ELSE NULL
  END,
  "usageRights" = CASE
    WHEN "cooperationDetails"->>'usageRights' IN (
      SELECT unnest(enum_range(NULL::"UsageRights")::TEXT[])
    )
    THEN ("cooperationDetails"->>'usageRights')::"UsageRights"
    ELSE NULL
  END,
  "usageDurationDays" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'usageDurationDays') = 'number'
    THEN ("cooperationDetails"->>'usageDurationDays')::INTEGER
    ELSE NULL
  END,
  "requiresMarking" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'requiresMarking') = 'boolean'
    THEN ("cooperationDetails"->>'requiresMarking')::BOOLEAN
    ELSE NULL
  END,
  "requiresContract" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'requiresContract') = 'boolean'
    THEN ("cooperationDetails"->>'requiresContract')::BOOLEAN
    ELSE NULL
  END,
  "ndaRequired" = CASE
    WHEN jsonb_typeof("cooperationDetails"->'ndaRequired') = 'boolean'
    THEN ("cooperationDetails"->>'ndaRequired')::BOOLEAN
    ELSE NULL
  END
WHERE "cooperationDetails" IS NOT NULL
  AND jsonb_typeof("cooperationDetails"::jsonb) = 'object'
  AND NOT (
    "cooperationDetails"::jsonb ? 'minFollowers'
    OR "cooperationDetails"::jsonb ? 'maxFollowers'
    OR "cooperationDetails"::jsonb ? 'contentStyle'
    OR "cooperationDetails"::jsonb ? 'languages'
  );

ALTER TABLE "Post" DROP COLUMN IF EXISTS "bloggerRequirements";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "cooperationDetails";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "bloggerRequirements";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "cooperationDetails";
