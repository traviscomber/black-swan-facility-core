-- Fix March gasoline prices to $1,180 COP/liter (March 15 reference price)
-- Update any gasoline entries from March that don't have the correct price

UPDATE fuel_consumption
SET cost_pesos = ROUND(liters * 1180, 2)
WHERE 
  fuel_type = 'gasoline'
  AND DATE(date_recorded) >= '2026-03-01'
  AND DATE(date_recorded) <= '2026-03-31'
  AND cost_pesos IS NOT NULL;

-- Verify the updates
SELECT 
  DATE(date_recorded) as fecha,
  COUNT(*) as transacciones,
  SUM(liters) as total_litros,
  ROUND(AVG(cost_pesos / liters), 0) as precio_promedio_por_litro,
  SUM(cost_pesos) as costo_total
FROM fuel_consumption
WHERE 
  fuel_type = 'gasoline'
  AND DATE(date_recorded) >= '2026-03-01'
  AND DATE(date_recorded) <= '2026-03-31'
GROUP BY DATE(date_recorded)
ORDER BY DATE(date_recorded) ASC;
