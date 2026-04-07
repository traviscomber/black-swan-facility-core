-- Update all January 2026 gasoline/bencina records with correct ENAP price
-- Official ENAP price for 29-01-2026: Average gasoline = $1,177.3/liter
-- Using weighted average: (1,140.9 + 1,177.7 + 1,213.4) / 3 = 1,177.3

UPDATE fuel_consumption
SET 
  cost_pesos = liters * 1177.3,
  updated_at = NOW()
WHERE 
  date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
  AND fuel_type = 'gasoline';

-- Verify the update
SELECT 
  fuel_type,
  COUNT(*) as transactions,
  ROUND(SUM(liters)::numeric, 2) as total_liters,
  ROUND(SUM(cost_pesos)::numeric, 2) as total_cost,
  ROUND((SUM(cost_pesos)::numeric / SUM(liters))::numeric, 2) as price_per_liter
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY fuel_type
ORDER BY fuel_type;
