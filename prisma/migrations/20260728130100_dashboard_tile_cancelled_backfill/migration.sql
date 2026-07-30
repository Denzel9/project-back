-- Backfill: enable cancelled tile for existing configs (role catalog filters on client)
UPDATE "UserConfig"
SET "dashboardTiles" = array_append("dashboardTiles", 'CANCELLED'::"DashboardTileType")
WHERE NOT ('CANCELLED'::"DashboardTileType" = ANY ("dashboardTiles"));
