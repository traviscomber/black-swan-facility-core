-- Add location_id foreign key to rooms table
-- This connects rooms to the locations table properly

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_rooms_location_id ON rooms(location_id);

-- Optional: Migrate existing text-based locations to proper FKs
-- This script attempts to match existing room.location text values to locations.name
-- You may need to run this manually after reviewing your data

-- UPDATE rooms r
-- SET location_id = l.id
-- FROM locations l
-- WHERE r.location = l.name AND r.location_id IS NULL;
