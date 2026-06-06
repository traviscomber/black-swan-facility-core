-- Identificar registros que NO se importaron
-- Comparando el total esperado vs lo importado

-- Primero, verificar los totales esperados vs importados por día
SELECT 
  '2026-01-04' as date_expected,
  95 as expected_liters_bencina,
  0 as expected_liters_diesel,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-04' AND fuel_type = 'gasoline') as imported_bencina,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-04' AND fuel_type = 'diesel') as imported_diesel
UNION ALL
SELECT '2026-01-05', 110, 0, 
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-05' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-05' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-06', 40, 176,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-06' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-06' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-07', 75, 50,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-07' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-07' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-08', 52, 200,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-08' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-08' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-09', 12, 132.42,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-09' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-09' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-10', 65, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-10' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-10' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-12', 42, 60,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-12' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-12' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-13', 74, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-13' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-13' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-14', 65, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-14' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-14' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-15', 45, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-15' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-15' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-16', 110, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-16' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-16' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-17', 50, 115,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-17' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-17' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-19', 115, 160,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-19' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-19' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-21', 40, 169,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-21' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-21' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-22', 5, 124,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-22' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-22' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-23', 0, 190,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-23' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-23' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-24', 90, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-24' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-24' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-25', 20, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-25' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-25' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-26', 0, 230,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-26' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-26' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-27', 35, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-27' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-27' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-28', 80, 0,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-28' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-28' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-30', 15, 180,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-30' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-30' AND fuel_type = 'diesel')
UNION ALL
SELECT '2026-01-31', 0, 50,
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-31' AND fuel_type = 'gasoline'),
  (SELECT COALESCE(SUM(liters), 0) FROM fuel_consumption WHERE date_recorded = '2026-01-31' AND fuel_type = 'diesel')
ORDER BY date_expected;
