-- Update all January 2026 diesel/petróleo records with correct price: $927.9 per liter
UPDATE fuel_consumption
SET cost_pesos = ROUND(liters * 927.9, 2)
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
  AND fuel_type = 'diesel';

-- Verify the update
SELECT 
  fuel_type,
  COUNT(*) as transactions,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  ROUND(SUM(cost_pesos)::numeric / SUM(liters), 2) as price_per_liter
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY fuel_type
ORDER BY fuel_type;

-- Summary of January 2026 after correction
SELECT 
  COUNT(*) as total_transactions,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost_january
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';
