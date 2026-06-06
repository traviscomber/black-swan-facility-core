-- Update all January fuel consumption records with correct prices by fuel type
-- Bencina: $1,500/liter
-- Petróleo: $400/liter

UPDATE fuel_consumption
SET cost_pesos = CASE
    WHEN fuel_type = 'gasoline' THEN liters * 1500
    WHEN fuel_type = 'diesel' THEN liters * 400
    ELSE cost_pesos
  END,
  updated_at = NOW()
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';

-- Verify the updates
SELECT 
  fuel_type,
  COUNT(*) as transaction_count,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  ROUND(SUM(cost_pesos)::numeric / SUM(liters), 2) as price_per_liter,
  ROUND(SUM(cost_pesos)) as total_cost_rounded
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY fuel_type
ORDER BY fuel_type;

-- Also show daily totals
SELECT 
  date_recorded,
  fuel_type,
  SUM(liters) as day_liters,
  SUM(cost_pesos) as day_cost
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY date_recorded, fuel_type
ORDER BY date_recorded, fuel_type;
