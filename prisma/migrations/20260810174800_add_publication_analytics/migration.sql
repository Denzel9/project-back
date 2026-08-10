-- CreateTable
CREATE TABLE "PublicationAnalytics" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "views" INTEGER DEFAULT 0,
    "likes" INTEGER DEFAULT 0,
    "comments" INTEGER DEFAULT 0,
    "shares" INTEGER DEFAULT 0,
    "saves" INTEGER DEFAULT 0,
    "reach" INTEGER DEFAULT 0,
    "impressions" INTEGER DEFAULT 0,
    "followersGain" INTEGER DEFAULT 0,
    "followersLoss" INTEGER DEFAULT 0,
    "engagementRate" DOUBLE PRECISION,
    "linkClicks" INTEGER DEFAULT 0,
    "watchTime" INTEGER DEFAULT 0,
    "avgWatchTime" DOUBLE PRECISION,
    "extraMetrics" JSONB,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationAnalytics_publicationId_idx" ON "PublicationAnalytics"("publicationId");

-- CreateIndex
CREATE INDEX "PublicationAnalytics_collectedAt_idx" ON "PublicationAnalytics"("collectedAt");

-- CreateIndex
CREATE INDEX "PublicationAnalytics_platform_idx" ON "PublicationAnalytics"("platform");

-- AddForeignKey
ALTER TABLE "PublicationAnalytics" ADD CONSTRAINT "PublicationAnalytics_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
