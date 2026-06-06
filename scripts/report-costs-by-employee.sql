-- Reporte: Costo Total por Empleado en Enero 2026
SELECT 
  e.name as employee_name,
  e.role,
  COUNT(*) as transactions,
  COUNT(DISTINCT fc.vehicle_id) as unique_vehicles,
  SUM(fc.liters) as total_liters,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END)::numeric, 2) as diesel_liters,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END)::numeric, 2) as gasoline_liters,
  ROUND(SUM(fc.cost_pesos)::numeric, 2) as total_cost,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END)::numeric, 2) as diesel_cost,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END)::numeric, 2) as gasoline_cost,
  ROUND((SUM(fc.cost_pesos) / NULLIF(SUM(fc.liters), 0))::numeric, 2) as avg_price_per_liter
FROM fuel_consumption fc
JOIN employees e ON fc.submitted_by = e.id
WHERE fc.date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY e.id, e.name, e.role
ORDER BY total_cost DESC;
