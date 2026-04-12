-- Insert March 2026 Fuel Consumption Data

-- Hector - March 2
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Cuatrimoto' LIMIT 1), 5, 'gasoline', 5900, '2026-03-02', 'FUEL-' || gen_random_uuid()::text;

-- Titan (Cristian XXX) - March 2
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Barcaza' LIMIT 1), 50, 'diesel', 59000, '2026-03-02', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Barcaza' LIMIT 1), 110, 'diesel', 129700, '2026-03-02', 'FUEL-' || gen_random_uuid()::text;

-- Hector - March 3
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Desbrozadora' LIMIT 1), 5, 'gasoline', 5900, '2026-03-03', 'FUEL-' || gen_random_uuid()::text;

-- Luis Miranda - March 2 & 3
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 15, 'gasoline', 17700, '2026-03-02', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 25, 'gasoline', 29500, '2026-03-03', 'FUEL-' || gen_random_uuid()::text;

-- Manfred Corcovado - March 4
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Bote Aluminio' LIMIT 1), 15, 'gasoline', 17700, '2026-03-04', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Nissan Navara' LIMIT 1), 40, 'diesel', 47200, '2026-03-04', 'FUEL-' || gen_random_uuid()::text;

-- Andres - March 4 & 5
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor Massey Ferguson' LIMIT 1), 81, 'diesel', 95580, '2026-03-04', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor New Holland' LIMIT 1), 116, 'diesel', 136880, '2026-03-04', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Maxus' LIMIT 1), 60, 'diesel', 70800, '2026-03-05', 'FUEL-' || gen_random_uuid()::text;

-- Titan (Cristian XXX) - March 5
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Camioneta Mastlan' LIMIT 1), 15, 'gasoline', 17700, '2026-03-05', 'FUEL-' || gen_random_uuid()::text;

-- Leandro - March 5 & 13
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1), 72, 'diesel', 84960, '2026-03-05', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1), 76, 'diesel', 89680, '2026-03-13', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1), 102, 'diesel', 120360, '2026-03-13', 'FUEL-' || gen_random_uuid()::text;

-- Hector - March 5
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Cuatrimoto' LIMIT 1), 5, 'gasoline', 5900, '2026-03-06', 'FUEL-' || gen_random_uuid()::text;

-- Titan (Cristian XXX) - March 9
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Barcaza' LIMIT 1), 50, 'diesel', 59000, '2026-03-09', 'FUEL-' || gen_random_uuid()::text;

-- Luis Miranda - March 6 & 9
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 25, 'gasoline', 29500, '2026-03-06', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lancha Aluminio' LIMIT 1), 10, 'gasoline', 11800, '2026-03-06', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 25, 'gasoline', 29500, '2026-03-09', 'FUEL-' || gen_random_uuid()::text;

-- Titan (Cristian XXX) - March 10
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Valmet' LIMIT 1), 50, 'diesel', 59000, '2026-03-10', 'FUEL-' || gen_random_uuid()::text;

-- Titan (Cristian XXX) - March 11
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor Massey Ferguson' LIMIT 1), 79, 'diesel', 93240, '2026-03-11', 'FUEL-' || gen_random_uuid()::text;

-- Hector - March 11
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Buggy' LIMIT 1), 30, 'gasoline', 35400, '2026-03-11', 'FUEL-' || gen_random_uuid()::text;

-- Luis Miranda - March 13 & 14
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 25, 'gasoline', 29500, '2026-03-13', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 15, 'gasoline', 17700, '2026-03-14', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1), 30, 'gasoline', 35400, '2026-03-14', 'FUEL-' || gen_random_uuid()::text;

-- Manfred Corcovado - March 15
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Nissan Navara' LIMIT 1), 40, 'diesel', 47200, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

-- Titan (Cristian XXX) - March 15
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Maxus' LIMIT 1), 47, 'diesel', 55480, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Retro' LIMIT 1), 57, 'diesel', 67320, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Generador' LIMIT 1), 70, 'diesel', 82600, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Barcaza Libe' LIMIT 1), 114, 'diesel', 134520, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

-- Leandro - March 15
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Tractor Azul' LIMIT 1), 162, 'diesel', 191160, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

-- Luis Miranda - March 15
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Lanchón' LIMIT 1), 15, 'gasoline', 17700, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Corcovado' LIMIT 1), 30, 'gasoline', 35400, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Moto de Agua Fomo I' LIMIT 1), 40, 'gasoline', 47200, '2026-03-15', 'FUEL-' || gen_random_uuid()::text;

-- Hector - March 17
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Motobomba Viñas' LIMIT 1), 5, 'gasoline', 5900, '2026-03-17', 'FUEL-' || gen_random_uuid()::text;

-- Manfred Corcovado - March 18
INSERT INTO fuel_consumption (submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, fuel_code)
SELECT (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), (SELECT id FROM vehicles WHERE name = 'Generador' LIMIT 1), 140, 'diesel', 165200, '2026-03-18', 'FUEL-' || gen_random_uuid()::text;

-- Display summary of inserted March data
SELECT 
  e.name as empleado,
  COUNT(*) as transacciones,
  SUM(fc.liters) as total_litros,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasolina_litros,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_litros,
  SUM(fc.cost_pesos) as costo_total
FROM fuel_consumption fc
LEFT JOIN employees e ON fc.submitted_by = e.id
WHERE DATE(fc.date_recorded) >= '2026-03-01' AND DATE(fc.date_recorded) <= '2026-03-31'
GROUP BY e.id, e.name
ORDER BY total_litros DESC;
