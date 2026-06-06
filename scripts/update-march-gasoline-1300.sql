-- Update all March 2026 gasoline prices to $1,300 COP per liter
-- Recalculate cost_pesos based on liters * $1,300

UPDATE fuel_consumption
SET 
  cost_pesos = ROUND(liters * 1300::numeric, 0),
  updated_at = NOW()
WHERE 
  fuel_type = 'gasoline'
  AND DATE(date_recorded) >= '2026-03-01'
  AND DATE(date_recorded) <= '2026-03-31';

-- Display summary of updated March gasoline records
SELECT 
  COUNT(*) as records_updated,
  SUM(liters) as total_gasoline_liters,
  ROUND(AVG(cost_pesos / liters)::numeric, 0) as avg_price_per_liter,
  SUM(cost_pesos) as total_cost_updated
FROM fuel_consumption
WHERE 
  fuel_type = 'gasoline'
  AND DATE(date_recorded) >= '2026-03-01'
  AND DATE(date_recorded) <= '2026-03-31';
