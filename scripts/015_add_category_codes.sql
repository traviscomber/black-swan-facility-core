-- Rewritten to use valid PostgreSQL UPDATE syntax without window functions
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS code TEXT;

-- Update existing categories with codes based on known names
UPDATE asset_categories SET code = 'COMP' WHERE name = 'Computers';
UPDATE asset_categories SET code = 'CAM' WHERE name = 'Cameras';
UPDATE asset_categories SET code = 'AUDIO' WHERE name = 'Audio Equipment';
UPDATE asset_categories SET code = 'PROJ' WHERE name = 'Projectors';
UPDATE asset_categories SET code = 'DISP' WHERE name = 'Displays';
UPDATE asset_categories SET code = 'NET' WHERE name = 'Networking';
UPDATE asset_categories SET code = 'STOR' WHERE name = 'Storage';
UPDATE asset_categories SET code = 'OTH' WHERE name = 'Other';

-- For any remaining categories without codes, use first 3 letters of name + sequential id suffix
UPDATE asset_categories 
SET code = UPPER(SUBSTRING(name, 1, 3)) || '-' || id::TEXT 
WHERE code IS NULL;

-- Add unique constraint
ALTER TABLE asset_categories ADD CONSTRAINT asset_categories_code_unique UNIQUE(code);

-- Make code column NOT NULL
ALTER TABLE asset_categories ALTER COLUMN code SET NOT NULL;
