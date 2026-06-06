-- Insert February 2026 Fuel Consumption Records
-- Employee mapping: Titan -> Cristian XXX, .hector -> Hector Alejandro Hidalgo, etc.
-- Fuel types: bencina = gasoline, petróleo = diesel
-- Prices: Gasoline $1,177.30/L, Diesel $927.90/L (ENAP Feb 2026)

INSERT INTO fuel_consumption (
  vehicle_id, submitted_by, date_recorded, liters, fuel_type, cost_pesos, fuel_code, created_at, updated_at, notes, source
) VALUES
-- 01 de febrero - Titan (Cristian XXX)
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-01', 25, 'gasoline', 29432.50, 'FC-202602-001', NOW(), NOW(), 'Bencina Lanchón 01 febrero', 'whatsapp'),

-- 02 de febrero - .hector (Hector Alejandro Hidalgo)
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-02', 5, 'gasoline', 5886.50, 'FC-202602-002', NOW(), NOW(), 'Bencina Motobomba Viñas 02 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-02', 5, 'gasoline', 5886.50, 'FC-202602-003', NOW(), NOW(), 'Bencina Cuatrimoto Roja 02 febrero', 'whatsapp'),

-- 02 de febrero - Titan (Cristian XXX)
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-02', 67, 'diesel', 62188.30, 'FC-202602-004', NOW(), NOW(), 'Petróleo Retro 2 febrero', 'whatsapp'),

-- 02 de febrero - Raimundo Colvin
((SELECT id FROM vehicles WHERE name = 'Buggy Hospitality' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1),
 '2026-02-02', 30, 'gasoline', 35319, 'FC-202602-005', NOW(), NOW(), 'Bencina Buggy Hospitality 2 febrero', 'whatsapp'),

-- 02 de febrero - Ruben (Seba Corcovado)
((SELECT id FROM vehicles WHERE name = 'Seba Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1),
 '2026-02-02', 40, 'gasoline', 47092, 'FC-202602-006', NOW(), NOW(), 'Bencina Seba Corcovado 2 febrero', 'whatsapp'),

-- 06 de febrero - .hector (Hector Alejandro Hidalgo)
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-06', 5, 'gasoline', 5886.50, 'FC-202602-007', NOW(), NOW(), 'Bencina Motobomba Viñas 6 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-06', 5, 'gasoline', 5886.50, 'FC-202602-008', NOW(), NOW(), 'Bencina Cuatrimoto Roja 6 febrero', 'whatsapp'),

-- 04-06 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-04', 25, 'gasoline', 29432.50, 'FC-202602-009', NOW(), NOW(), 'Bencina Lanchón 4 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-04', 30, 'gasoline', 35319, 'FC-202602-010', NOW(), NOW(), 'Bencina Corcovado 4 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-06', 30, 'gasoline', 35319, 'FC-202602-011', NOW(), NOW(), 'Bencina Lanchón 6 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-06', 30, 'gasoline', 35319, 'FC-202602-012', NOW(), NOW(), 'Bencina Corcovado 6 febrero', 'whatsapp'),

-- 07 de febrero - Cristian XXX
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-07', 50, 'diesel', 46395, 'FC-202602-013', NOW(), NOW(), 'Petróleo Retro 7 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-07', 25, 'gasoline', 29432.50, 'FC-202602-014', NOW(), NOW(), 'Bencina Lanchón 7 febrero', 'whatsapp'),

-- 07 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-07', 60, 'gasoline', 70638, 'FC-202602-015', NOW(), NOW(), 'Bencina Corcovado 7 febrero', 'whatsapp'),

-- 10 de febrero - Andres Sandoval
((SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-10', 120, 'diesel', 111348, 'FC-202602-016', NOW(), NOW(), 'Petróleo Tractor Azul 10 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Generador' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-10', 80, 'diesel', 74232, 'FC-202602-017', NOW(), NOW(), 'Petróleo Generador 10 febrero', 'whatsapp'),

-- 11 de febrero - Raimundo Colvin
((SELECT id FROM vehicles WHERE name = 'Buggy Hospitality' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1),
 '2026-02-11', 25, 'gasoline', 29432.50, 'FC-202602-018', NOW(), NOW(), 'Bencina Buggy Hospitality 11 febrero', 'whatsapp'),

-- 12 de febrero - .hector (Hector Alejandro Hidalgo)
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-12', 5, 'gasoline', 5886.50, 'FC-202602-019', NOW(), NOW(), 'Bencina Motobomba Viñas 12 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-12', 5, 'gasoline', 5886.50, 'FC-202602-020', NOW(), NOW(), 'Bencina Cuatrimoto Roja 12 febrero', 'whatsapp'),

-- 13 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-13', 25, 'gasoline', 29432.50, 'FC-202602-021', NOW(), NOW(), 'Bencina Lanchón 13 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-13', 30, 'gasoline', 35319, 'FC-202602-022', NOW(), NOW(), 'Bencina Corcovado 13 febrero', 'whatsapp'),

-- 14 de febrero - Cristian XXX
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-14', 60, 'diesel', 55674, 'FC-202602-023', NOW(), NOW(), 'Petróleo Retro 14 febrero', 'whatsapp'),

-- 15 de febrero - Andres Sandoval
((SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-15', 100, 'diesel', 92790, 'FC-202602-024', NOW(), NOW(), 'Petróleo Tractor Azul 15 febrero', 'whatsapp'),

-- 16 de febrero - Raimundo Colvin
((SELECT id FROM vehicles WHERE name = 'Buggy Hospitality' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1),
 '2026-02-16', 20, 'gasoline', 23546, 'FC-202602-025', NOW(), NOW(), 'Bencina Buggy Hospitality 16 febrero', 'whatsapp'),

-- 17 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-17', 30, 'gasoline', 35319, 'FC-202602-026', NOW(), NOW(), 'Bencina Lanchón 17 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-17', 40, 'gasoline', 47092, 'FC-202602-027', NOW(), NOW(), 'Bencina Corcovado 17 febrero', 'whatsapp'),

-- 19 de febrero - Hector Alejandro Hidalgo
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-19', 6, 'gasoline', 7063.80, 'FC-202602-028', NOW(), NOW(), 'Bencina Motobomba Viñas 19 febrero', 'whatsapp'),

-- 20 de febrero - Cristian XXX
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-20', 20, 'gasoline', 23546, 'FC-202602-029', NOW(), NOW(), 'Bencina Lanchón 20 febrero', 'whatsapp'),

-- 21 de febrero - Andres Sandoval
((SELECT id FROM vehicles WHERE name = 'Generador' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-21', 70, 'diesel', 64953, 'FC-202602-030', NOW(), NOW(), 'Petróleo Generador 21 febrero', 'whatsapp'),

-- 22 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-22', 25, 'gasoline', 29432.50, 'FC-202602-031', NOW(), NOW(), 'Bencina Lanchón 22 febrero', 'whatsapp'),

-- 24 de febrero - Raimundo Colvin
((SELECT id FROM vehicles WHERE name = 'Buggy Hospitality' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1),
 '2026-02-24', 30, 'gasoline', 35319, 'FC-202602-032', NOW(), NOW(), 'Bencina Buggy Hospitality 24 febrero', 'whatsapp'),

-- 25 de febrero - Cristian XXX
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-25', 55, 'diesel', 51034.50, 'FC-202602-033', NOW(), NOW(), 'Petróleo Retro 25 febrero', 'whatsapp'),

-- 26 de febrero - Hector Alejandro Hidalgo
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-26', 5, 'gasoline', 5886.50, 'FC-202602-034', NOW(), NOW(), 'Bencina Motobomba Viñas 26 febrero', 'whatsapp'),

-- 27 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-27', 50, 'gasoline', 58865, 'FC-202602-035', NOW(), NOW(), 'Bencina Corcovado 27 febrero', 'whatsapp'),

-- 28 de febrero - Seba Corcovado
((SELECT id FROM vehicles WHERE name = 'Seba Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1),
 '2026-02-28', 45, 'gasoline', 52978.50, 'FC-202602-036', NOW(), NOW(), 'Bencina Seba Corcovado 28 febrero', 'whatsapp');

-- Display summary of inserted records
SELECT 
  DATE_TRUNC('month', date_recorded)::date as month,
  COUNT(*) as total_records,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  COUNT(DISTINCT submitted_by) as employees,
  COUNT(DISTINCT vehicle_id) as vehicles
FROM fuel_consumption
WHERE DATE_TRUNC('month', date_recorded) = '2026-02-01'
GROUP BY DATE_TRUNC('month', date_recorded);
