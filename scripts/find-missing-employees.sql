-- Analyzeemployees that appear in fuel data but might not match exactly in database
-- List all unique employee names that should exist based on fuel consumption data

WITH expected_employees AS (
  SELECT DISTINCT employee_name
  FROM (
    VALUES
    ('Luis Miranda'),
    ('Manfred Corcovado'),
    ('Hector Alejandro Hidalgo'),
    ('Andres Sandoval?'),
    ('Cristian xxx'),
    ('Raimundo Colvin'),
    ('Ruben Flandes'),
    ('.hector')
  ) AS data(employee_name)
)
SELECT 
  e.employee_name,
  CASE 
    WHEN db.id IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING - needs WhatsApp_ prefix'
  END as status,
  db.name as db_name
FROM expected_employees e
LEFT JOIN employees db ON db.name = e.employee_name OR db.name ILIKE e.employee_name
ORDER BY status DESC, e.employee_name;
