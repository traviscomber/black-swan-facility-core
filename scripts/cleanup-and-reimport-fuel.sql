-- First, delete all January 2026 fuel consumption records to ensure clean import
DELETE FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';

-- Verify deletion
SELECT COUNT(*) as remaining_january_records
FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';
