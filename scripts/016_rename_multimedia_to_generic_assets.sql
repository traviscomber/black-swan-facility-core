-- Migration: Rename multimedia-specific tables to generic asset tables
-- This makes the inventory system work for all Blackswan ecosystem assets, not just multimedia

-- Step 1: Rename multimedia_assets table to assets
ALTER TABLE IF EXISTS multimedia_assets RENAME TO assets;

-- Step 2: Rename multimedia_asset_logs table to asset_logs
ALTER TABLE IF EXISTS multimedia_asset_logs RENAME TO asset_logs;

-- Step 3: Update foreign key in asset_logs to reference new assets table name
ALTER TABLE asset_logs DROP CONSTRAINT IF EXISTS multimedia_asset_logs_asset_id_fkey;
ALTER TABLE asset_logs ADD CONSTRAINT asset_logs_asset_id_fkey 
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

-- Step 4: Rename indexes to match new table names
ALTER INDEX IF EXISTS idx_multimedia_assets_category RENAME TO idx_assets_category;
ALTER INDEX IF EXISTS idx_multimedia_assets_cost_center RENAME TO idx_assets_cost_center;
ALTER INDEX IF EXISTS idx_multimedia_assets_status RENAME TO idx_assets_status;
ALTER INDEX IF EXISTS idx_multimedia_assets_code RENAME TO idx_assets_code;
ALTER INDEX IF EXISTS idx_multimedia_asset_logs_asset RENAME TO idx_asset_logs_asset;

-- Step 5: Create index on asset_logs for efficient queries
CREATE INDEX IF NOT EXISTS idx_asset_logs_changed_at ON asset_logs(changed_at DESC);

-- Step 6: Update RLS policies to reference new table names
DROP POLICY IF EXISTS "Allow all on multimedia_assets" ON assets;
DROP POLICY IF EXISTS "Allow all on multimedia_asset_logs" ON asset_logs;

CREATE POLICY "Allow all on assets" ON assets FOR ALL USING (true);
CREATE POLICY "Allow all on asset_logs" ON asset_logs FOR ALL USING (true);

-- Verify the migration
SELECT 'Migration completed successfully' as status;
SELECT count(*) as assets_count FROM assets;
SELECT count(*) as logs_count FROM asset_logs;
