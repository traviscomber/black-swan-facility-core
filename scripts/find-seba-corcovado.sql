-- Check who the unknown employee ID belongs to
SELECT id, name FROM employees WHERE id = '7a2e35c2-bd97-4e3a-afc4-23949bc8f463';

-- Check if Seba Corcovado exists
SELECT id, name FROM employees WHERE name LIKE '%Seba%' OR name LIKE '%Corcovado%';

-- Show all employees
SELECT id, name FROM employees ORDER BY name;
