-- Insert remaining 12 fuel records that use .hector -> WhatsApp_.hector
WITH hector_records AS (
  SELECT 
    ROW_NUMBER() OVER () + 85 as rn,
    v.id as vehicle_id,
    (SELECT id FROM employees WHERE name = 'WhatsApp_.hector' LIMIT 1) as submitted_by,
    data.date_recorded,
    data.fuel_type,
    data.liters,
    data.cost_pesos
  FROM (
    VALUES 
    ('2026-01-05'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-05'::date, 'Desbrozadora', 'Bencina', 5.0, 7500.0),
    ('2026-01-08'::date, 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-08'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-13'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-13'::date, 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-16'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-19'::date, 'Cuatrimoto', 'Bencina', 5.0, 7500.0),
    ('2026-01-19'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-21'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0),
    ('2026-01-21'::date, 'Cuatrimoto roja', 'Bencina', 5.0, 7500.0),
    ('2026-01-24'::date, 'Motobomba viñas', 'Bencina', 5.0, 7500.0)
  ) AS data(date_recorded, vehicle_name, fuel_type, liters, cost_pesos)
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
  'gasoline'::fuel_type_enum as fuel_type,
  liters,
  cost_pesos,
  'Field Station' as location,
  'January 2026 fuel report (.hector)' as notes,
  'manual' as source,
  NOW() as created_at,
  NOW() as updated_at
FROM hector_records;

-- Final totals
SELECT 'Final Import Summary' as message,
       COUNT(*) as total_imported, 
       COUNT(DISTINCT vehicle_id) as unique_vehicles,
       COUNT(DISTINCT submitted_by) as unique_employees,
       SUM(liters) as total_liters,
       SUM(cost_pesos) as total_cost
FROM fuel_consumption 
WHERE date_recorded BETWEEN '2026-01-01' AND '2026-01-31';
