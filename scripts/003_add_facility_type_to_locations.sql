-- Add facility_type column to locations table to distinguish between different property types
ALTER TABLE locations ADD COLUMN facility_type TEXT DEFAULT 'rental';

-- Add constraint to ensure valid facility types
ALTER TABLE locations ADD CONSTRAINT valid_facility_type CHECK (facility_type IN ('rental', 'storage', 'laundry', 'garden', 'office', 'utility', 'parking', 'other'));

-- Update existing locations with type (assuming they are rentals)
UPDATE locations SET facility_type = 'rental' WHERE facility_type IS NULL;
