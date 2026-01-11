-- Rewrote migration to use valid SQL syntax without WHERE in INSERT

-- Add parent_category_id column to asset_categories for hierarchical structure
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL;

-- Create main category groups - check first if Multimedia parent already exists
DO $$
BEGIN
  -- Insert Multimedia parent if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM asset_categories WHERE name = 'Multimedia' AND parent_category_id IS NULL) THEN
    INSERT INTO asset_categories (name, code, icon, color, description, parent_category_id) 
    VALUES ('Multimedia', 'MM', 'package', '#8b5cf6', 'Multimedia - Audio, video, and visual equipment', NULL);
  END IF;
  
  -- Insert IT Equipment parent if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM asset_categories WHERE name = 'IT Equipment' AND parent_category_id IS NULL) THEN
    INSERT INTO asset_categories (name, code, icon, color, description, parent_category_id) 
    VALUES ('IT Equipment', 'IT', 'cpu', '#3b82f6', 'Computer and networking infrastructure', NULL);
  END IF;
  
  -- Insert Facilities parent if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM asset_categories WHERE name = 'Facilities' AND parent_category_id IS NULL) THEN
    INSERT INTO asset_categories (name, code, icon, color, description, parent_category_id) 
    VALUES ('Facilities', 'FAC', 'building-2', '#10b981', 'Facility and infrastructure equipment', NULL);
  END IF;
  
  -- Insert Cattle Operations parent if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM asset_categories WHERE name = 'Cattle Operations' AND parent_category_id IS NULL) THEN
    INSERT INTO asset_categories (name, code, icon, color, description, parent_category_id) 
    VALUES ('Cattle Operations', 'CATTLE', 'activity', '#f97316', 'Livestock and cattle operations equipment', NULL);
  END IF;
END $$;

-- Update existing categories to belong to Multimedia parent group
UPDATE asset_categories SET parent_category_id = (
  SELECT id FROM asset_categories WHERE name = 'Multimedia' AND parent_category_id IS NULL LIMIT 1
)
WHERE name IN ('Computers', 'Cameras', 'Audio Equipment', 'Projectors', 'Displays', 'Storage', 'Networking', 'Other')
AND parent_category_id IS NULL;

-- Create index for hierarchical queries
CREATE INDEX IF NOT EXISTS idx_asset_categories_parent ON asset_categories(parent_category_id);
