-- Recalculate March 2026 gasoline prices
-- Using consistent price per liter for gasoline in March 2026

-- Price calculation: ~$1,180 COP per liter for gasoline
-- Update all gasoline entries for March 2026

UPDATE fuel_consumption
SET cost_pesos = ROUND(liters * 1180, 0)
WHERE 
  fuel_type = 'gasoline' 
  AND DATE(date_recorded) >= '2026-03-01' 
  AND DATE(date_recorded) <= '2026-03-31'
  AND submitted_by IN (
    SELECT id FROM employees 
    WHERE name IN ('Hector Alejandro Hidalgo', 'Cristian XXX', 'Luis Miranda', 'Seba Corcovado', 'Andres Sandoval', 'Raimundo Colvin')
  );

-- Display summary after update
SELECT 
  e.name as empleado,
  COUNT(*) as transacciones,
  SUM(fc.liters) as total_litros,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasolina_litros,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_litros,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END) as gasolina_costo,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END) as diesel_costo,
  SUM(fc.cost_pesos) as costo_total
FROM fuel_consumption fc
LEFT JOIN employees e ON fc.submitted_by = e.id
WHERE DATE(fc.date_recorded) >= '2026-03-01' AND DATE(fc.date_recorded) <= '2026-03-31'
GROUP BY e.id, e.name
ORDER BY total_litros DESC;
