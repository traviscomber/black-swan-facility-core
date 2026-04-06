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
SELECT 'VEH-001', 'Corcovado', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Corcovado');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-002', 'Lanchón', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Lanchón');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-003', 'Lancha aluminio', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Lancha aluminio');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-004', 'Buggy', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Buggy');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-005', 'Buggy 2', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Buggy 2');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-006', 'Buggy azul', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Buggy azul');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-007', 'Motobomba viñas', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Motobomba viñas');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-008', 'Desbrozadora', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Desbrozadora');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-009', 'Cuatrimoto roja', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Cuatrimoto roja');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-010', 'Cuatrimoto', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Cuatrimoto');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-011', 'Bote aluminio', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Bote aluminio');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-012', 'Retro', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Retro');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-013', 'Tractor Massey Ferguson', 'tractor', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Tractor Massey Ferguson');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-014', 'Tractor New Holland', 'tractor', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Tractor New Holland');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-015', 'Nissan Navara', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Nissan Navara');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-016', 'Maxus', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Maxus');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-017', 'Chipiadora', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Chipiadora');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-018', 'Retro constructora', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Retro constructora');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-019', 'Generador hotelito', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Generador hotelito');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-020', 'Fomo 1', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Fomo 1');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-021', 'Camioneta Wingle', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Camioneta Wingle');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-022', 'Moto 1', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Moto 1');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-023', 'Moto 2', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Moto 2');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-024', 'Desbrozadora jardín', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Desbrozadora jardín');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-025', 'Generador Honda', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Generador Honda');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-026', 'Tractor azul', 'tractor', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Tractor azul');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-027', 'Barcaza Libe', 'truck', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Barcaza Libe');

INSERT INTO vehicles (code, name, vehicle_type, status, created_at, updated_at)
SELECT 'VEH-028', 'Generador', 'van', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM vehicles WHERE name = 'Generador');

-- Summary
SELECT 'Setup Complete' as status, 
       (SELECT COUNT(*) FROM employees) as total_employees,
       (SELECT COUNT(*) FROM vehicles) as total_vehicles;
