-- Add color column to gis_overlays table
ALTER TABLE gis_overlays ADD COLUMN IF NOT EXISTS color text DEFAULT '#3388ff';

-- Add comment for documentation
COMMENT ON COLUMN gis_overlays.color IS 'Hex color code for KMZ polygon visualization';
