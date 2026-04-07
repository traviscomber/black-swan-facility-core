-- Triple check: Comparar litros y costos de Petróleo (Diesel)
SELECT 
  fuel_type,
  COUNT(*) as transacciones,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  ROUND(SUM(cost_pesos)::numeric / SUM(liters), 0) as price_per_liter_calculated,
  MIN(cost_pesos / NULLIF(liters, 0)) as min_price_per_liter,
  MAX(cost_pesos / NULLIF(liters, 0)) as max_price_per_liter,
  AVG(cost_pesos / NULLIF(liters, 0)) as avg_price_per_liter
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY fuel_type
ORDER BY fuel_type;

-- Ver algunos registros de petróleo para verificar si los precios están correctos
SELECT 
  date_recorded,
  fuel_type,
  liters,
  cost_pesos,
  ROUND(cost_pesos / liters, 0) as price_per_liter,
  submitted_by
FROM fuel_consumption
WHERE fuel_type = 'diesel'
  AND date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
LIMIT 20;
