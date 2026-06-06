-- Reporte: Desglose de Gasto por Vehículo y Empleado (Diesel vs Gasolina)
SELECT 
  v.name as vehicle_name,
  e.name as employee_name,
  COUNT(*) as transactions,
  SUM(fc.liters) as total_liters,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END)::numeric, 2) as diesel_liters,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END)::numeric, 2) as gasoline_liters,
  ROUND(SUM(fc.cost_pesos)::numeric, 2) as total_cost,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END)::numeric, 2) as diesel_cost,
  ROUND(SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END)::numeric, 2) as gasoline_cost,
  ROUND((SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END) / NULLIF(SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END), 0))::numeric, 2) as diesel_price_per_liter,
  ROUND((SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END) / NULLIF(SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END), 0))::numeric, 2) as gasoline_price_per_liter
FROM fuel_consumption fc
JOIN vehicles v ON fc.vehicle_id = v.id
JOIN employees e ON fc.submitted_by = e.id
WHERE fc.date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY v.id, v.name, e.id, e.name
ORDER BY total_cost DESC;
