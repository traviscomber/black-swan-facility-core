-- Insert February 2026 Fuel Consumption Records
-- Using correct vehicle IDs and employee IDs

INSERT INTO fuel_consumption (
  date_recorded,
  submitted_by,
  vehicle_id,
  fuel_type,
  liters,
  cost_pesos,
  fuel_code,
  created_at,
  updated_at
) VALUES
-- Feb 1: Cristian XXX - Lanchón
('2026-02-01 08:30:00', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 'diesel', 50.00, 58500.00, 'FCO-2026-02-001', NOW(), NOW()),

-- Feb 2: Hector Alejandro Hidalgo - Retro
('2026-02-02 09:15:00', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 'diesel', 45.00, 52650.00, 'FCO-2026-02-002', NOW(), NOW()),

-- Feb 3: Luis Miranda - Tractor azul
('2026-02-03 10:00:00', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 'diesel', 60.00, 70200.00, 'FCO-2026-02-003', NOW(), NOW()),

-- Feb 3: Raimundo Colvin - Motobomba viñas
('2026-02-03 11:30:00', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 'diesel', 35.00, 40950.00, 'FCO-2026-02-004', NOW(), NOW()),

-- Feb 4: Andres Sandoval - Lanchón
('2026-02-04 08:00:00', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 'gasoline', 40.00, 52800.00, 'FCO-2026-02-005', NOW(), NOW()),

-- Feb 5: Seba Corcovado - Buggy
('2026-02-05 09:30:00', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), '80464716-39b2-45c4-ab2a-a6f24ac087a7', 'gasoline', 20.00, 26400.00, 'FCO-2026-02-006', NOW(), NOW()),

-- Feb 6: Cristian XXX - Chipiadora
('2026-02-06 07:00:00', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), '4575fc62-5ff5-433f-a548-dc9913265254', 'gasoline', 55.00, 72600.00, 'FCO-2026-02-007', NOW(), NOW()),

-- Feb 7: Hector Alejandro Hidalgo - Desbrozadora
('2026-02-07 14:00:00', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), '55585808-4bb1-4e88-a91d-9b78790b8450', 'gasoline', 15.00, 19800.00, 'FCO-2026-02-008', NOW(), NOW()),

-- Feb 8: Luis Miranda - Moto 1
('2026-02-08 10:15:00', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), '8574c7f2-da84-4deb-871f-8bcbc1f9dc3b', 'gasoline', 10.00, 13200.00, 'FCO-2026-02-009', NOW(), NOW()),

-- Feb 9: Raimundo Colvin - Retro
('2026-02-09 09:00:00', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 'diesel', 50.00, 58500.00, 'FCO-2026-02-010', NOW(), NOW()),

-- Feb 10: Andres Sandoval - Tractor azul
('2026-02-10 08:30:00', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 'diesel', 70.00, 81900.00, 'FCO-2026-02-011', NOW(), NOW()),

-- Feb 11: Seba Corcovado - Cuatrimoto
('2026-02-11 15:00:00', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), 'd78c34d3-3db4-4234-b443-0f15016d7e82', 'gasoline', 18.00, 23760.00, 'FCO-2026-02-012', NOW(), NOW()),

-- Feb 12: Cristian XXX - Motobomba viñas
('2026-02-12 06:30:00', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 'diesel', 40.00, 46800.00, 'FCO-2026-02-013', NOW(), NOW()),

-- Feb 13: Hector Alejandro Hidalgo - Lanchón
('2026-02-13 11:00:00', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 'diesel', 48.00, 56160.00, 'FCO-2026-02-014', NOW(), NOW()),

-- Feb 14: Luis Miranda - Buggy
('2026-02-14 10:30:00', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), '80464716-39b2-45c4-ab2a-a6f24ac087a7', 'gasoline', 25.00, 33000.00, 'FCO-2026-02-015', NOW(), NOW()),

-- Feb 15: Raimundo Colvin - Chipiadora
('2026-02-15 13:15:00', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), '4575fc62-5ff5-433f-a548-dc9913265254', 'gasoline', 60.00, 79200.00, 'FCO-2026-02-016', NOW(), NOW()),

-- Feb 16: Andres Sandoval - Desbrozadora
('2026-02-16 14:45:00', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), '55585808-4bb1-4e88-a91d-9b78790b8450', 'gasoline', 20.00, 26400.00, 'FCO-2026-02-017', NOW(), NOW()),

-- Feb 17: Seba Corcovado - Retro
('2026-02-17 09:00:00', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 'diesel', 55.00, 64350.00, 'FCO-2026-02-018', NOW(), NOW()),

-- Feb 18: Cristian XXX - Tractor azul
('2026-02-18 07:30:00', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 'diesel', 65.00, 76050.00, 'FCO-2026-02-019', NOW(), NOW()),

-- Feb 19: Hector Alejandro Hidalgo - Motobomba viñas
('2026-02-19 12:00:00', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 'diesel', 35.00, 40950.00, 'FCO-2026-02-020', NOW(), NOW()),

-- Feb 20: Luis Miranda - Lanchón
('2026-02-20 08:15:00', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 'gasoline', 45.00, 59400.00, 'FCO-2026-02-021', NOW(), NOW()),

-- Feb 21: Raimundo Colvin - Cuatrimoto
('2026-02-21 16:30:00', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), 'd78c34d3-3db4-4234-b443-0f15016d7e82', 'gasoline', 22.00, 29040.00, 'FCO-2026-02-022', NOW(), NOW()),

-- Feb 22: Andres Sandoval - Buggy
('2026-02-22 10:00:00', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), '80464716-39b2-45c4-ab2a-a6f24ac087a7', 'gasoline', 30.00, 39600.00, 'FCO-2026-02-023', NOW(), NOW()),

-- Feb 23: Seba Corcovado - Chipiadora
('2026-02-23 08:30:00', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), '4575fc62-5ff5-433f-a548-dc9913265254', 'gasoline', 50.00, 66000.00, 'FCO-2026-02-024', NOW(), NOW()),

-- Feb 24: Cristian XXX - Retro
('2026-02-24 09:45:00', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 'diesel', 52.00, 60840.00, 'FCO-2026-02-025', NOW(), NOW()),

-- Feb 25: Hector Alejandro Hidalgo - Tractor azul
('2026-02-25 07:00:00', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 'diesel', 58.00, 67860.00, 'FCO-2026-02-026', NOW(), NOW()),

-- Feb 26: Luis Miranda - Motobomba viñas
('2026-02-26 13:30:00', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 'diesel', 38.00, 44460.00, 'FCO-2026-02-027', NOW(), NOW()),

-- Feb 27: Raimundo Colvin - Lanchón
('2026-02-27 10:15:00', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 'gasoline', 42.00, 55440.00, 'FCO-2026-02-028', NOW(), NOW());

-- Display summary of inserted February data
SELECT 
  e.name as empleado,
  COUNT(*) as transacciones,
  SUM(fc.liters) as total_litros,
  SUM(CASE WHEN fc.fuel_type = 'gasoline' THEN fc.liters ELSE 0 END) as gasolina_litros,
  SUM(CASE WHEN fc.fuel_type = 'diesel' THEN fc.liters ELSE 0 END) as diesel_litros,
  SUM(fc.cost_pesos) as costo_total
FROM fuel_consumption fc
LEFT JOIN employees e ON fc.submitted_by = e.id
WHERE DATE(fc.date_recorded) >= '2026-02-01' AND DATE(fc.date_recorded) <= '2026-02-28'
GROUP BY e.id, e.name
ORDER BY total_litros DESC;
