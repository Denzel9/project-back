-- AlterTable
ALTER TABLE "Publication" ADD COLUMN "platformLinks" JSONB;

-- Backfill platformLinks from externalUrl
UPDATE "Publication"
SET "platformLinks" = jsonb_build_object(
  COALESCE(
    "platform"::text,
    (
      SELECT elem->>'platform'
      FROM jsonb_array_elements(
        CASE
          WHEN "deliverables" IS NOT NULL AND jsonb_typeof("deliverables") = 'array'
            THEN "deliverables"
          ELSE '[]'::jsonb
        END
      ) AS elem
      WHERE elem->>'platform' IS NOT NULL AND TRIM(elem->>'platform') <> ''
      LIMIT 1
    ),
    'OTHER'
  ),
  "externalUrl"
)
WHERE "externalUrl" IS NOT NULL AND TRIM("externalUrl") <> '';
