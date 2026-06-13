-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "finalPrice" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "finalPrice" TYPE TEXT USING (
  CASE WHEN "finalPrice" = true THEN 'true' ELSE '' END
);
ALTER TABLE "Post" ALTER COLUMN "finalPrice" SET DEFAULT '';
