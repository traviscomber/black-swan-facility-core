-- Verify and complete migration from multimedia_assets to assets
-- This script handles cases where the migration was partially completed

-- Step 1: Verify current state
SELECT 'Checking table existence...' as step;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assets') as assets_exists;
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_logs') as asset_logs_exists;

-- Step 2: Clean up old RLS policies if they exist
DROP POLICY IF EXISTS "Allow all on multimedia_assets" ON assets;
DROP POLICY IF EXISTS "Allow all on multimedia_asset_logs" ON asset_logs;

-- Replace invalid CREATE POLICY IF NOT EXISTS with conditional drop + create
DROP POLICY IF EXISTS "Allow all on assets" ON assets;
CREATE POLICY "Allow all on assets" ON assets FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all on asset_logs" ON asset_logs;
CREATE POLICY "Allow all on asset_logs" ON asset_logs FOR ALL USING (true);

-- Step 3: Verify foreign key relationships
SELECT constraint_name, table_name, column_name 
FROM information_schema.key_column_usage 
WHERE table_name IN ('assets', 'asset_logs') 
ORDER BY table_name;

-- Step 4: Final verification - count records
SELECT 'Migration verification complete' as status;
SELECT count(*) as total_assets FROM assets;
SELECT count(*) as total_logs FROM asset_logs;
