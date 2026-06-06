-- Deep Fuel Analysis for January 2026
-- Comprehensive analysis of fuel consumption patterns

-- 1. Daily consumption and costs
SELECT 
  date_recorded,
  SUM(CASE WHEN fuel_type = 'gasoline' THEN liters ELSE 0 END) as gasoline_liters,
  SUM(CASE WHEN fuel_type = 'diesel' THEN liters ELSE 0 END) as diesel_liters,
  SUM(CASE WHEN fuel_type = 'gasoline' THEN cost_pesos ELSE 0 END) as gasoline_cost,
  SUM(CASE WHEN fuel_type = 'diesel' THEN cost_pesos ELSE 0 END) as diesel_cost,
  SUM(cost_pesos) as total_daily_cost,
  COUNT(*) as transactions_count
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY date_recorded
ORDER BY date_recorded;

-- 2. Top vehicles by fuel consumption
SELECT 
  v.name,
  COUNT(*) as transactions,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasoline_liters,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_liters,
  SUM(fc.liters) as total_liters,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END) as gasoline_cost,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END) as diesel_cost,
  SUM(fc.cost_pesos) as total_cost,
  ROUND(SUM(fc.cost_pesos) / SUM(fc.liters), 2) as avg_price_per_liter
FROM fuel_consumption fc
JOIN vehicles v ON fc.vehicle_id = v.id
WHERE fc.date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY v.id, v.name
ORDER BY SUM(fc.cost_pesos) DESC;

-- 3. Top employees by fuel expenses
SELECT 
  e.name,
  COUNT(*) as transactions,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasoline_liters,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_liters,
  SUM(fc.liters) as total_liters,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END) as gasoline_cost,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END) as diesel_cost,
  SUM(fc.cost_pesos) as total_cost,
  ROUND(SUM(fc.cost_pesos) / SUM(fc.liters), 2) as avg_price_per_liter
FROM fuel_consumption fc
JOIN employees e ON fc.submitted_by = e.id
WHERE fc.date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY e.id, e.name
ORDER BY SUM(fc.cost_pesos) DESC;

-- 4. Fuel type summary
SELECT 
  fuel_type,
  COUNT(*) as transactions,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  ROUND(SUM(cost_pesos) / SUM(liters), 2) as price_per_liter,
  ROUND(AVG(liters), 2) as avg_liters_per_transaction
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY fuel_type;

-- 5. Vehicle-Employee matrix (who used what vehicle and fuel cost)
SELECT 
  v.name as vehicle,
  e.name as employee,
  COUNT(*) as transactions,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasoline_liters,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_liters,
  SUM(fc.liters) as total_liters,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.cost_pesos ELSE 0 END) as gasoline_cost,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.cost_pesos ELSE 0 END) as diesel_cost,
  SUM(fc.cost_pesos) as total_cost
FROM fuel_consumption fc
JOIN vehicles v ON fc.vehicle_id = v.id
JOIN employees e ON fc.submitted_by = e.id
WHERE fc.date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY v.id, v.name, e.id, e.name
ORDER BY SUM(fc.cost_pesos) DESC;
