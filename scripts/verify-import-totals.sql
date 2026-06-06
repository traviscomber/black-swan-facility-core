-- Check what was imported vs expected totals
SELECT 
  TO_CHAR(date_recorded, 'DD-mon') as fecha,
  SUM(CASE WHEN fuel_type = 'gasoline' THEN liters ELSE 0 END) as bencina_l,
  SUM(CASE WHEN fuel_type = 'diesel' THEN liters ELSE 0 END) as petroleo_l,
  SUM(liters) as total_litros,
  COUNT(*) as registros
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY TO_CHAR(date_recorded, 'DD-mon'), date_recorded
ORDER BY date_recorded;

-- Summary
SELECT 
  'TOTALES' as resumen,
  SUM(CASE WHEN fuel_type = 'gasoline' THEN liters ELSE 0 END) as bencina_total,
  SUM(CASE WHEN fuel_type = 'diesel' THEN liters ELSE 0 END) as petroleo_total,
  SUM(liters) as total_general,
  COUNT(*) as total_registros
FROM fuel_consumption
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';
