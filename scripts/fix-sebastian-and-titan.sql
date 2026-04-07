-- Fix employee names
-- 1. Rename "Sebastian Manlfer" to "Sebastian Manfler"
UPDATE employees 
SET name = 'Sebastian Manfler' 
WHERE name = 'Sebastian Manlfer';

-- 2. Rename "Titan" to "Cristian XXX" (merge with existing Cristian)
UPDATE employees 
SET name = 'Cristian XXX' 
WHERE name = 'Titan';

-- 3. Show fuel consumption records with orphaned employee IDs
SELECT 
  submitted_by,
  COUNT(*) as records_count,
  SUM(liters) as total_liters
FROM fuel_consumption
WHERE submitted_by NOT IN (SELECT id FROM employees)
GROUP BY submitted_by;

-- 4. Show all fuel records and their employee names (for verification)
SELECT 
  e.name as employee,
  COUNT(fc.id) as transactions,
  SUM(fc.liters) as total_liters,
  SUM(fc.cost_pesos) as total_cost
FROM fuel_consumption fc
LEFT JOIN employees e ON fc.submitted_by = e.id
GROUP BY e.name
ORDER BY total_liters DESC;
