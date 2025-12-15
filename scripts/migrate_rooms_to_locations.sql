-- Migration to link existing rooms to proper locations
-- This maps old text-based location field to the new location_id FK

-- First, let's see what we have
-- SELECT id, name FROM locations ORDER BY name;
-- SELECT id, room_number, location, location_id FROM rooms ORDER BY location;

-- Update rooms to link to actual locations
-- You'll need to manually map your old location text values to the new location IDs

-- Example: If "Main Lodge" rooms should map to a location called "Bamboo House":
-- UPDATE rooms SET location_id = (SELECT id FROM locations WHERE name = 'Bamboo House' LIMIT 1) WHERE location = 'Main Lodge';

-- Example: If "North Woods" rooms should map to "North Access":
-- UPDATE rooms SET location_id = (SELECT id FROM locations WHERE name = 'North Access' LIMIT 1) WHERE location = 'North Woods';

-- Generic update for all rooms - maps by matching location text to location name
UPDATE rooms 
SET location_id = locations.id
FROM locations
WHERE rooms.location = locations.name
AND rooms.location_id IS NULL;

-- For rooms that still don't have a location_id, you'll need to manually assign them
-- SELECT id, room_number, location FROM rooms WHERE location_id IS NULL;
