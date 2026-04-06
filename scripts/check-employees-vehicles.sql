-- Check existing employees and vehicles
SELECT 'Employees:' as category;
SELECT DISTINCT name FROM employees WHERE is_active = true ORDER BY name LIMIT 20;

SELECT 'Vehicles:' as category;
SELECT DISTINCT name FROM vehicles WHERE status = 'active' ORDER BY name LIMIT 20;
