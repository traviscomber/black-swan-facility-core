-- Check the CHECK constraint for vehicle_type
-- Get distinct vehicle types already in the database
SELECT DISTINCT vehicle_type 
FROM vehicles 
ORDER BY vehicle_type;
