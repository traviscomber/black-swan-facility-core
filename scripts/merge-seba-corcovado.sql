-- Create Seba Corcovado as employee if not exists
INSERT INTO employees (name, created_at, updated_at)
VALUES ('Seba Corcovado', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Get the ID of Seba Corcovado
WITH seba_id AS (
  SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1
)
-- Reassign the 8 orphan records to Seba Corcovado
UPDATE fuel_consumption
SET submitted_by = (SELECT id FROM seba_id)
WHERE submitted_by = '7a2e35c2-bd97-4e3a-afc4-23949bc8f463';

-- Show final consumption summary by employee
SELECT 
  e.name,
  COUNT(*) as transacciones,
  SUM(fc.liters) as total_litros,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasolina_litros,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_litros,
  SUM(fc.cost_pesos) as costo_total,
  ROUND(SUM(fc.cost_pesos)::numeric / SUM(fc.liters), 2) as precio_promedio_litro
FROM fuel_consumption fc
LEFT JOIN employees e ON fc.submitted_by = e.id
WHERE DATE(fc.date_recorded) >= '2026-01-01' AND DATE(fc.date_recorded) <= '2026-01-31'
GROUP BY e.id, e.name
ORDER BY total_litros DESC;
