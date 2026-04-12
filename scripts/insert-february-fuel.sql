-- Insert February 2026 Fuel Consumption Records
-- Employee mapping: Titan -> Cristian XXX, .hector -> Hector Alejandro Hidalgo, etc.
-- Fuel types: bencina = gasoline, petróleo = diesel
-- Prices: Gasoline $1,177.30/L, Diesel $927.90/L (ENAP Feb 2026)

INSERT INTO fuel_consumption (
  vehicle_id, submitted_by, date_recorded, liters, fuel_type, cost_pesos, created_at, updated_at, notes, source
) VALUES
-- 01 de febrero - Titan (Cristian XXX)
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-01', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 01 febrero', 'whatsapp'),

-- 02 de febrero - .hector (Hector Alejandro Hidalgo)
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-02', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 02 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-02', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Cuatrimoto Roja 02 febrero', 'whatsapp'),

-- 02 de febrero - Titan (Cristian XXX)
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-02', 67, 'diesel', 62188.30, NOW(), NOW(), 'Petróleo Retro 2 febrero', 'whatsapp'),

-- 02 de febrero - Raimundo Colvin
((SELECT id FROM vehicles WHERE name = 'Buggy Hospitality' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1),
 '2026-02-02', 30, 'gasoline', 35319, NOW(), NOW(), 'Bencina Buggy Hospitality 2 febrero', 'whatsapp'),

-- 02 de febrero - Ruben (Seba Corcovado)
((SELECT id FROM vehicles WHERE name = 'Seba Corcovado' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1),
 '2026-02-02', 40, 'gasoline', 47092, NOW(), NOW(), 'Bencina Seba Corcovado 2 febrero', 'whatsapp'),

-- 06 de febrero - .hector (Hector Alejandro Hidalgo)
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-06', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 6 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-06', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Cuatrimoto Roja 6 febrero', 'whatsapp'),

-- 04-06 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-04', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 4 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lancha Aluminio' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-04', 15, 'gasoline', 17659.50, NOW(), NOW(), 'Bencina Lancha Aluminio 4 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-05', 10, 'gasoline', 11773, NOW(), NOW(), 'Bencina Lanchón 5 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lancha Aluminio' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-05', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Lancha Aluminio 5 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-06', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 6 febrero', 'whatsapp'),

-- 06 de febrero - Manfred Corcovado (Sebastian Manfler)
((SELECT id FROM vehicles WHERE name = 'Bote Aluminio' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1),
 '2026-02-06', 15, 'gasoline', 17659.50, NOW(), NOW(), 'Bencina Bote Aluminio 6 febrero', 'whatsapp'),

-- 09 de febrero - Titan (Cristian XXX)
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-09', 65, 'diesel', 60313.50, NOW(), NOW(), 'Petróleo Retro 9 febrero', 'whatsapp'),

-- 09 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-09', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 9 febrero', 'whatsapp'),

-- 10 de febrero - Titan
((SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-10', 82, 'diesel', 76087.80, NOW(), NOW(), 'Petróleo Tractor Azul 10 febrero', 'whatsapp'),

-- 10 de febrero - Andres
((SELECT id FROM vehicles WHERE name = 'Tractor Valmet' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-10', 22, 'diesel', 20413.80, NOW(), NOW(), 'Petróleo Tractor Valmet 10 febrero', 'whatsapp'),

-- 11 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-11', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 11 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-11', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Cuatrimoto Roja 11 febrero', 'whatsapp'),

-- 11 de febrero - Titan
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-11', 76, 'diesel', 70519.40, NOW(), NOW(), 'Petróleo Retro 11 febrero', 'whatsapp'),

-- 12 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-12', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 12 febrero', 'whatsapp'),

-- 09-11 febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-09', 15, 'gasoline', 17659.50, NOW(), NOW(), 'Bencina Lanchón 9 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-11', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 11 febrero', 'whatsapp'),

-- 14 de febrero - Andres
((SELECT id FROM vehicles WHERE name = 'Maxus' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-14', 50, 'diesel', 46395, NOW(), NOW(), 'Petróleo Maxus 14 febrero', 'whatsapp'),

-- 14 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Desbrozadora' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-14', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Desbrozadora 14 febrero', 'whatsapp'),

-- 16 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-16', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 16 febrero', 'whatsapp'),

-- 16 de febrero - Titan
((SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-16', 40, 'diesel', 37116, NOW(), NOW(), 'Petróleo Retro 16 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-16', 15, 'diesel', 13918.50, NOW(), NOW(), 'Petróleo Tractor Azul 16 febrero', 'whatsapp'),

-- 18 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-18', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 18 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-18', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Cuatrimoto Roja 18 febrero', 'whatsapp'),

-- 15-18 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-15', 20, 'gasoline', 23546, NOW(), NOW(), 'Bencina Lanchón 15 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-18', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 18 febrero', 'whatsapp'),

-- 22 de febrero - Titan
((SELECT id FROM vehicles WHERE name = 'Bote Aluminio' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-22', 12, 'gasoline', 14127.60, NOW(), NOW(), 'Bencina Bote Aluminio 22 febrero', 'whatsapp'),

-- 23 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-23', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 23 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Desbrozadora' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-23', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Desbrozadora 23 febrero', 'whatsapp'),

-- 21 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-21', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 21 febrero', 'whatsapp'),

-- 24 de febrero - Titan
((SELECT id FROM vehicles WHERE name = 'Barcaza Libe' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1),
 '2026-02-24', 90, 'diesel', 83511, NOW(), NOW(), 'Petróleo Barcaza Libe 24 febrero', 'whatsapp'),

-- 24 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Cuatrimoto Roja' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-24', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Cuatrimoto Roja 24 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-24', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 24 febrero', 'whatsapp'),

-- 24 de febrero - Luis Miranda
((SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1),
 '2026-02-24', 25, 'gasoline', 29432.50, NOW(), NOW(), 'Bencina Lanchón 24 febrero', 'whatsapp'),

-- 25 de febrero - Manfred Corcovado (Sebastian Manfler)
((SELECT id FROM vehicles WHERE name = 'Nissan Navara' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1),
 '2026-02-25', 40, 'diesel', 37116, NOW(), NOW(), 'Diesel Nissan Navara 25 febrero', 'whatsapp'),

((SELECT id FROM vehicles WHERE name = 'Mini Escabadora' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1),
 '2026-02-25', 40, 'diesel', 37116, NOW(), NOW(), 'Diesel Mini Escabadora 25 febrero', 'whatsapp'),

-- 25 de febrero - Andres
((SELECT id FROM vehicles WHERE name = 'Maxus' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1),
 '2026-02-25', 57, 'diesel', 52880.30, NOW(), NOW(), 'Petróleo Maxus 25 febrero', 'whatsapp'),

-- 25 de febrero - .hector
((SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1),
 (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1),
 '2026-02-25', 5, 'gasoline', 5886.50, NOW(), NOW(), 'Bencina Motobomba Viñas 25 febrero', 'whatsapp');

-- Show summary of inserted records
SELECT 
  COUNT(*) as total_records,
  SUM(liters) as total_liters,
  SUM(cost_pesos) as total_cost,
  COUNT(DISTINCT vehicle_id) as vehicles_count,
  COUNT(DISTINCT submitted_by) as employees_count
FROM fuel_consumption
WHERE DATE(date_recorded) >= '2026-02-01' AND DATE(date_recorded) <= '2026-02-29';
