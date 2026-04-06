-- Delete all January 2026 fuel consumption records
DELETE FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';

-- Import ALL 97 January 2026 Fuel Consumption Data with placeholders for unknown employees
WITH numbered_data AS (
  SELECT 
    ROW_NUMBER() OVER () as rn,
    v.id as vehicle_id,
    COALESCE(e.id, (SELECT id FROM employees WHERE name = 'WhatsApp_placeholder' LIMIT 1)) as submitted_by,
    data.date_recorded,
    data.fuel_type,
    data.liters,
    data.cost_pesos,
    data.employee_name
  FROM (
    -- 2026-01-04
    VALUES 
    ('2026-01-04'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 50.0, 75000.0),
    ('2026-01-04'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 30.0, 45000.0),
    ('2026-01-04'::date, 'Luis Miranda', 'Lancha aluminio', 'Bencina', 15.0, 22500.0),
    -- 2026-01-05
    ('2026-01-05'::date, 'Manfred Corcovado', 'Buggy 2', 'Bencina', 30.0, 45000.0),
    ('2026-01-05'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-05'::date, '.hector', 'Desbrozadora', 'Bencina', 5.0, 7500.0),
    ('2026-01-05'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 30.0, 45000.0),
    ('2026-01-05'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 30.0, 45000.0),
    ('2026-01-05'::date, 'Luis Miranda', 'Lancha aluminio', 'Bencina', 10.0, 15000.0),
    -- 2026-01-06
    ('2026-01-06'::date, 'Manfred Corcovado', 'Lanchón', 'Bencina', 25.0, 37500.0),
    ('2026-01-06'::date, 'Manfred Corcovado', 'Bote aluminio', 'Bencina', 15.0, 22500.0),
    ('2026-01-06'::date, 'Andres Sandoval?', 'Tractor Massey Ferguson', 'Petróleo', 114.0, 45600.0),
    ('2026-01-06'::date, 'Andres Sandoval?', 'Tractor New Holland', 'Petróleo', 62.0, 24800.0),
    -- 2026-01-07
    ('2026-01-07'::date, 'Cristian xxx', 'Retro', 'Petróleo', 50.0, 20000.0),
    ('2026-01-07'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 60.0, 90000.0),
    ('2026-01-07'::date, 'Luis Miranda', 'Lancha aluminio', 'Bencina', 15.0, 22500.0),
    -- 2026-01-08
    ('2026-01-08'::date, '.hector', 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-08'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-08'::date, 'Cristian xxx', 'Lanchón', 'Bencina', 25.0, 37500.0),
    ('2026-01-08'::date, 'Cristian xxx', 'Bote aluminio', 'Bencina', 12.0, 18000.0),
    ('2026-01-08'::date, 'Ruben Flandes', 'Chipiadora', 'Bencina', 5.0, 7500.0),
    ('2026-01-08'::date, 'Andres Sandoval?', 'Tractor New Holland', 'Petróleo', 100.0, 40000.0),
    ('2026-01-08'::date, 'Andres Sandoval?', 'Tractor Massey Ferguson', 'Petróleo', 50.0, 20000.0),
    ('2026-01-08'::date, 'Andres Sandoval?', 'Maxus', 'Petróleo', 50.0, 20000.0),
    -- 2026-01-09
    ('2026-01-09'::date, 'Cristian xxx', 'Bote aluminio', 'Bencina', 12.0, 18000.0),
    ('2026-01-09'::date, 'Andres Sandoval?', 'Retro constructora', 'Petróleo', 132.42, 52968.0),
    -- 2026-01-10
    ('2026-01-10'::date, 'Andres Sandoval?', 'Buggy', 'Bencina', 20.0, 30000.0),
    ('2026-01-10'::date, 'Andres Sandoval?', 'Generador hotelito', 'Bencina', 5.0, 7500.0),
    ('2026-01-10'::date, 'Cristian xxx', 'Lanchón', 'Bencina', 25.0, 37500.0),
    ('2026-01-10'::date, 'Luis Miranda', 'Fomo 1', 'Bencina', 15.0, 22500.0),
    -- 2026-01-12
    ('2026-01-12'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-12'::date, 'Manfred Corcovado', 'Nissan Navara', 'Petróleo', 60.0, 24000.0),
    ('2026-01-12'::date, 'Cristian xxx', 'Lanchón', 'Bencina', 25.0, 37500.0),
    ('2026-01-12'::date, 'Cristian xxx', 'Bote aluminio', 'Bencina', 12.0, 18000.0),
    -- 2026-01-13
    ('2026-01-13'::date, 'Andres Sandoval?', 'Camioneta Wingle', 'Bencina', 50.0, 75000.0),
    ('2026-01-13'::date, 'Raimundo Colvin', 'Moto 1', 'Bencina', 7.0, 10500.0),
    ('2026-01-13'::date, 'Raimundo Colvin', 'Moto 2', 'Bencina', 7.0, 10500.0),
    ('2026-01-13'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-13'::date, '.hector', 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    -- 2026-01-14
    ('2026-01-14'::date, 'Raimundo Colvin', 'Buggy', 'Bencina', 25.0, 37500.0),
    ('2026-01-14'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 40.0, 60000.0),
    -- 2026-01-15
    ('2026-01-15'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 20.0, 30000.0),
    ('2026-01-15'::date, 'Cristian xxx', 'Lanchón', 'Bencina', 25.0, 37500.0),
    -- 2026-01-16
    ('2026-01-16'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-16'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 50.0, 75000.0),
    ('2026-01-16'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 15.0, 22500.0),
    ('2026-01-16'::date, 'Ruben Flandes', 'Corcovado', 'Bencina', 40.0, 60000.0),
    -- 2026-01-17
    ('2026-01-17'::date, 'Cristian xxx', 'Maxus', 'Petróleo', 65.0, 26000.0),
    ('2026-01-17'::date, 'Manfred Corcovado', 'Nissan Navara', 'Petróleo', 50.0, 20000.0),
    ('2026-01-17'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 40.0, 60000.0),
    ('2026-01-17'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 10.0, 15000.0),
    -- 2026-01-19
    ('2026-01-19'::date, 'Cristian xxx', 'Barcaza Libe', 'Petróleo', 160.0, 64000.0),
    ('2026-01-19'::date, '.hector', 'Cuatrimoto', 'Bencina', 5.0, 7500.0),
    ('2026-01-19'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-19'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 50.0, 75000.0),
    ('2026-01-19'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 25.0, 37500.0),
    ('2026-01-19'::date, 'Manfred Corcovado', 'Lanchón', 'Bencina', 25.0, 37500.0),
    -- 2026-01-21
    ('2026-01-21'::date, 'Manfred Corcovado', 'Buggy', 'Bencina', 20.0, 30000.0),
    ('2026-01-21'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-21'::date, '.hector', 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-21'::date, 'Raimundo Colvin', 'Tractor azul', 'Petróleo', 169.0, 67600.0),
    ('2026-01-21'::date, 'Ruben Flandes', 'Chipiadora', 'Bencina', 10.0, 15000.0),
    -- 2026-01-22
    ('2026-01-22'::date, 'Raimundo Colvin', 'Tractor azul', 'Petróleo', 124.0, 49600.0),
    ('2026-01-22'::date, 'Ruben Flandes', 'Desbrozadora jardín', 'Bencina', 5.0, 7500.0),
    -- 2026-01-23
    ('2026-01-23'::date, 'Andres Sandoval?', 'Generador', 'Petróleo', 150.0, 60000.0),
    ('2026-01-23'::date, 'Andres Sandoval?', 'Maxus', 'Petróleo', 40.0, 16000.0),
    -- 2026-01-24
    ('2026-01-24'::date, 'Andres Sandoval?', 'Buggy', 'Bencina', 20.0, 30000.0),
    ('2026-01-24'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-24'::date, '.hector', 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-24'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 50.0, 75000.0),
    ('2026-01-24'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 10.0, 15000.0),
    -- 2026-01-25
    ('2026-01-25'::date, 'Andres Sandoval?', 'Generador Honda', 'Bencina', 20.0, 30000.0),
    -- 2026-01-26
    ('2026-01-26'::date, 'Cristian xxx', 'Tractor azul', 'Petróleo', 44.0, 17600.0),
    ('2026-01-26'::date, 'Andres Sandoval?', 'Retro constructora', 'Petróleo', 120.0, 48000.0),
    ('2026-01-26'::date, 'Raimundo Colvin', 'Tractor azul', 'Petróleo', 66.0, 26400.0),
    -- 2026-01-27
    ('2026-01-27'::date, '.hector', 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-27'::date, '.hector', 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-27'::date, 'Andres Sandoval?', 'Buggy azul', 'Bencina', 25.0, 37500.0),
    -- 2026-01-28
    ('2026-01-28'::date, 'Luis Miranda', 'Corcovado', 'Bencina', 50.0, 75000.0),
    ('2026-01-28'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 30.0, 45000.0),
    -- 2026-01-30
    ('2026-01-30'::date, 'Andres Sandoval?', 'Generador', 'Petróleo', 60.0, 24000.0),
    ('2026-01-30'::date, 'Raimundo Colvin', 'Generador', 'Petróleo', 60.0, 24000.0),
    ('2026-01-30'::date, 'Manfred Corcovado', 'Nissan Navara', 'Petróleo', 60.0, 24000.0),
    ('2026-01-30'::date, 'Luis Miranda', 'Lanchón', 'Bencina', 15.0, 22500.0),
    -- 2026-01-31
    ('2026-01-31'::date, 'Andres Sandoval?', 'Generador', 'Petróleo', 50.0, 20000.0)
  ) AS data(date_recorded, employee_name, vehicle_name, fuel_type, liters, cost_pesos)
  LEFT JOIN employees e ON (
    (data.employee_name = 'Cristian xxx' AND e.name = 'Cristian xxx') OR
    (data.employee_name = 'Luis Miranda' AND e.name = 'Luis Miranda') OR
    (data.employee_name = 'Manfred Corcovado' AND e.name = 'Manfred Corcovado') OR
    (data.employee_name = '.hector' AND e.name = 'Hector Alejandro Hidalgo') OR
    (data.employee_name = 'Andres Sandoval?' AND e.name = 'Andres Sandoval?') OR
    (data.employee_name = 'Raimundo Colvin' AND e.name = 'Raimundo Colvin') OR
    (data.employee_name = 'Ruben Flandes' AND e.name = 'Ruben Flandes')
  )
  LEFT JOIN vehicles v ON v.name ILIKE data.vehicle_name
  WHERE v.id IS NOT NULL
)
INSERT INTO fuel_consumption (
  fuel_code,
  vehicle_id,
  submitted_by,
  date_recorded,
  fuel_type,
  liters,
  cost_pesos,
  location,
  notes,
  source,
  created_at,
  updated_at
) 
SELECT 
  'FC-' || TO_CHAR(date_recorded, 'YYYYMMDD') || '-' || LPAD(rn::text, 3, '0') as fuel_code,
  vehicle_id,
  submitted_by,
  date_recorded,
  CASE 
    WHEN fuel_type = 'Bencina' THEN 'gasoline'
    WHEN fuel_type = 'Petróleo' THEN 'diesel'
    ELSE 'other'
  END as fuel_type,
  liters,
  cost_pesos,
  'Field Station' as location,
  'January 2026 fuel report' as notes,
  'manual' as source,
  NOW() as created_at,
  NOW() as updated_at
FROM numbered_data;

-- Check import results
SELECT COUNT(*) as total_imported, 
       COUNT(DISTINCT vehicle_id) as unique_vehicles,
       COUNT(DISTINCT submitted_by) as unique_employees,
       SUM(liters) as total_liters,
       SUM(cost_pesos) as total_cost
FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';
