-- Create missing employees and vehicles for fuel consumption data
-- First, insert missing employees (if they don't exist)
INSERT INTO employees (name, email, phone, role, is_active, created_at, updated_at)
SELECT 'Manfred Corcovado', 'manfred@facility.local', NULL, 'Operario', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Manfred Corcovado');

INSERT INTO employees (name, email, phone, role, is_active, created_at, updated_at)
SELECT 'Titan', 'titan@facility.local', NULL, 'Operario', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Titan');

-- Insert missing vehicles (if they don't exist) - using valid types: drone, tractor, truck, van
INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'CRC', 'Corcovado', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Corcovado');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'LAN', 'Lanchón', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Lanchón');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'LAA', 'Lancha aluminio', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Lancha aluminio');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'BUG', 'Buggy', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Buggy');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'BG2', 'Buggy 2', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Buggy 2');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'BGA', 'Buggy azul', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Buggy azul');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'MBV', 'Motobomba viñas', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Motobomba viñas');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'DSB', 'Desbrozadora', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Desbrozadora');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'CUR', 'Cuatrimoto roja', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Cuatrimoto roja');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'CU1', 'Cuatrimoto', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Cuatrimoto');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'BOA', 'Bote aluminio', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Bote aluminio');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'RET', 'Retro', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Retro');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'TMF', 'Tractor Massey Ferguson', 'tractor', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Tractor Massey Ferguson');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'TNH', 'Tractor New Holland', 'tractor', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Tractor New Holland');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'NIS', 'Nissan Navara', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Nissan Navara');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'MAX', 'Maxus', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Maxus');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'CHP', 'Chipiadora', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Chipiadora');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'RTC', 'Retro constructora', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Retro constructora');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'GHT', 'Generador hotelito', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Generador hotelito');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'FOM', 'Fomo 1', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Fomo 1');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'CMW', 'Camioneta Wingle', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Camioneta Wingle');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'MT1', 'Moto 1', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Moto 1');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'MT2', 'Moto 2', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Moto 2');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'DSJ', 'Desbrozadora jardín', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Desbrozadora jardín');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'GHN', 'Generador Honda', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Generador Honda');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'TAZ', 'Tractor azul', 'tractor', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Tractor azul');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'BRL', 'Barcaza Libe', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Barcaza Libe');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'GEN', 'Generador', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Generador');

-- Summary
SELECT 'Setup Complete' as status, 
       (SELECT COUNT(*) FROM employees) as total_employees,
       (SELECT COUNT(*) FROM vehicles) as total_vehicles;
