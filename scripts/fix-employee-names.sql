-- Step 1: Fix "Andres Sandoval?" -> "Andres Sandoval"
UPDATE employees
SET name = 'Andres Sandoval'
WHERE name = 'Andres Sandoval?';

-- Step 2: Merge WhatsApp_hector with Hector Alejandro Hidalgo
-- Update all fuel records that reference WhatsApp_hector to use Hector's ID instead
UPDATE fuel_consumption
SET submitted_by = (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1)
WHERE submitted_by = (SELECT id FROM employees WHERE name = 'WhatsApp_.hector' LIMIT 1);

-- Step 3: Delete the WhatsApp_hector employee since all records have been merged
DELETE FROM employees
WHERE name = 'WhatsApp_.hector';

-- Step 4: Check for "Unknown" employees and see their fuel records
SELECT 
  e.id,
  e.name,
  COUNT(fc.id) as fuel_records_count,
  STRING_AGG(DISTINCT fc.notes, '; ') as notes,
  MIN(fc.date_recorded) as first_record,
  MAX(fc.date_recorded) as last_record
FROM employees e
LEFT JOIN fuel_consumption fc ON e.id = fc.submitted_by
WHERE e.name LIKE '%unknown%' OR e.name IS NULL OR e.name = ''
GROUP BY e.id, e.name
ORDER BY fuel_records_count DESC;
