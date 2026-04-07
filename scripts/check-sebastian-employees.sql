-- Check all employees and find Sebastian/Seba variations
SELECT id, name FROM employees ORDER BY name;

-- Check fuel records for Sebastian-related names
SELECT DISTINCT submitted_by FROM fuel_consumption WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31' ORDER BY submitted_by;
