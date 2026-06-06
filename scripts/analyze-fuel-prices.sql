-- Analyze current fuel prices from January data
SELECT 
  fuel_type,
  COUNT(*) as transactions,
  ROUND(AVG(cost_pesos / liters), 2) as price_per_liter_jan,
  ROUND(MIN(cost_pesos / liters), 2) as min_price,
  ROUND(MAX(cost_pesos / liters), 2) as max_price,
  ROUND(SUM(liters), 2) as total_liters,
  ROUND(SUM(cost_pesos), 0) as total_cost
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY fuel_type
ORDER BY fuel_type;
