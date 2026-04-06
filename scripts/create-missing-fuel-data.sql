-- Create missing employees and vehicles for fuel consumption data
-- First, insert missing employees
INSERT INTO employees (name, email, phone, role, is_active, created_at, updated_at)
VALUES
  ('Manfred Corcovado', 'manfred@facility.local', NULL, 'Operario', true, NOW(), NOW()),
  ('Titan', 'titan@facility.local', NULL, 'Operario', true, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Insert missing vehicles
INSERT INTO vehicles (name, type, status, location, created_at, updated_at)
VALUES
  ('Corcovado', 'Bote', 'active', 'Water Station', NOW(), NOW()),
  ('Lanchón', 'Bote', 'active', 'Water Station', NOW(), NOW()),
  ('Lancha aluminio', 'Bote', 'active', 'Water Station', NOW(), NOW()),
  ('Buggy', 'ATV', 'active', 'Main Station', NOW(), NOW()),
  ('Buggy 2', 'ATV', 'active', 'Main Station', NOW(), NOW()),
  ('Buggy azul', 'ATV', 'active', 'Main Station', NOW(), NOW()),
  ('Motobomba viñas', 'Equipment', 'active', 'Vineyard', NOW(), NOW()),
  ('Desbrozadora', 'Equipment', 'active', 'Landscape', NOW(), NOW()),
  ('Cuatrimoto roja', 'ATV', 'active', 'Main Station', NOW(), NOW()),
  ('Cuatrimoto', 'ATV', 'active', 'Main Station', NOW(), NOW()),
  ('Bote aluminio', 'Bote', 'active', 'Water Station', NOW(), NOW()),
  ('Retro', 'Excavator', 'active', 'Construction', NOW(), NOW()),
  ('Tractor Massey Ferguson', 'Tractor', 'active', 'Farm', NOW(), NOW()),
  ('Tractor New Holland', 'Tractor', 'active', 'Farm', NOW(), NOW()),
  ('Nissan Navara', 'Truck', 'active', 'Main Station', NOW(), NOW()),
  ('Maxus', 'Truck', 'active', 'Main Station', NOW(), NOW()),
  ('Chipiadora', 'Equipment', 'active', 'Landscape', NOW(), NOW()),
  ('Retro constructora', 'Excavator', 'active', 'Construction', NOW(), NOW()),
  ('Generador hotelito', 'Generator', 'active', 'Hotel', NOW(), NOW()),
  ('Fomo 1', 'Bote', 'active', 'Water Station', NOW(), NOW()),
  ('Camioneta Wingle', 'Truck', 'active', 'Main Station', NOW(), NOW()),
  ('Moto 1', 'Motorcycle', 'active', 'Main Station', NOW(), NOW()),
  ('Moto 2', 'Motorcycle', 'active', 'Main Station', NOW(), NOW()),
  ('Desbrozadora jardín', 'Equipment', 'active', 'Landscape', NOW(), NOW()),
  ('Generador Honda', 'Generator', 'active', 'Main Station', NOW(), NOW()),
  ('Tractor azul', 'Tractor', 'active', 'Farm', NOW(), NOW()),
  ('Barcaza Libe', 'Barge', 'active', 'Water Station', NOW(), NOW()),
  ('Generador', 'Generator', 'active', 'Main Station', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

SELECT 'Setup Complete' as status, 
       (SELECT COUNT(*) FROM employees) as total_employees,
       (SELECT COUNT(*) FROM vehicles) as total_vehicles;
