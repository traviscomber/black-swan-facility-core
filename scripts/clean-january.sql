-- Delete all existing January 2026 fuel consumption records
DELETE FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';

SELECT COUNT(*) as records_deleted FROM (
  SELECT 1 FROM fuel_consumption 
  WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
) as deleted;
