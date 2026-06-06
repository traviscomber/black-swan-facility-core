-- Check gasoline prices in database
-- Looking at January and February to determine correct March price

SELECT 
  DATE(date_recorded) as date,
  fuel_type,
  COUNT(*) as transactions,
  AVG(cost_pesos / NULLIF(liters, 0)) as avg_price_per_liter,
  MIN(cost_pesos / NULLIF(liters, 0)) as min_price_per_liter,
  MAX(cost_pesos / NULLIF(liters, 0)) as max_price_per_liter
FROM fuel_consumption
WHERE fuel_type = 'gasoline' AND DATE(date_recorded) >= '2026-02-01'
GROUP BY DATE(date_recorded), fuel_type
ORDER BY date DESC;
