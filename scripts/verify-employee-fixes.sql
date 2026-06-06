-- Verify employee name fixes
SELECT 
  e.name,
  COUNT(fc.id) as transacciones,
  SUM(fc.liters) as total_liters,
  SUM(fc.cost_pesos) as total_cost
FROM employees e
LEFT JOIN fuel_consumption fc ON e.id = fc.submitted_by
WHERE fc.date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY e.id, e.name
ORDER BY total_liters DESC;
