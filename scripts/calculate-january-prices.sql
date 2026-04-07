-- Calculate average fuel prices from January 2026 consolidated data
-- Based on the daily totals provided

WITH january_data(date_recorded, fuel_type, liters, cost_pesos) AS (
  VALUES 
    ('2026-01-04'::date, 'Bencina', 95.0, 142500.0),
    ('2026-01-05'::date, 'Bencina', 75.0, 112500.0),
    ('2026-01-06'::date, 'Bencina', 40.0, 60000.0),
    ('2026-01-06'::date, 'Petróleo', 176.0, 70400.0),
    ('2026-01-07'::date, 'Bencina', 75.0, 112500.0),
    ('2026-01-07'::date, 'Petróleo', 50.0, 20000.0),
    ('2026-01-08'::date, 'Bencina', 52.0, 78000.0),
    ('2026-01-08'::date, 'Petróleo', 200.0, 80000.0),
    ('2026-01-09'::date, 'Bencina', 12.0, 18000.0),
    ('2026-01-09'::date, 'Petróleo', 132.42, 52968.0),
    ('2026-01-10'::date, 'Bencina', 65.0, 97500.0),
    ('2026-01-12'::date, 'Bencina', 42.0, 63000.0),
    ('2026-01-12'::date, 'Petróleo', 60.0, 24000.0),
    ('2026-01-13'::date, 'Bencina', 64.0, 96000.0),
    ('2026-01-14'::date, 'Bencina', 45.0, 67500.0),
    ('2026-01-15'::date, 'Bencina', 45.0, 67500.0),
    ('2026-01-16'::date, 'Bencina', 110.0, 165000.0),
    ('2026-01-17'::date, 'Bencina', 50.0, 75000.0),
    ('2026-01-17'::date, 'Petróleo', 115.0, 46000.0),
    ('2026-01-19'::date, 'Bencina', 85.0, 127500.0),
    ('2026-01-19'::date, 'Petróleo', 160.0, 64000.0),
    ('2026-01-21'::date, 'Bencina', 30.0, 45000.0),
    ('2026-01-21'::date, 'Petróleo', 169.0, 67600.0),
    ('2026-01-22'::date, 'Bencina', 5.0, 7500.0),
    ('2026-01-22'::date, 'Petróleo', 124.0, 49600.0),
    ('2026-01-23'::date, 'Petróleo', 190.0, 76000.0),
    ('2026-01-24'::date, 'Bencina', 90.0, 135000.0),
    ('2026-01-25'::date, 'Bencina', 20.0, 30000.0),
    ('2026-01-26'::date, 'Petróleo', 230.0, 92000.0),
    ('2026-01-27'::date, 'Bencina', 35.0, 52500.0),
    ('2026-01-28'::date, 'Bencina', 80.0, 120000.0),
    ('2026-01-30'::date, 'Bencina', 15.0, 22500.0),
    ('2026-01-30'::date, 'Petróleo', 180.0, 72000.0),
    ('2026-01-31'::date, 'Petróleo', 50.0, 20000.0)
)
SELECT 
  fuel_type,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  ROUND(SUM(cost_pesos)::numeric / SUM(liters), 2) as price_per_liter
FROM january_data
GROUP BY fuel_type
ORDER BY fuel_type;
