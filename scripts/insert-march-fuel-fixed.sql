-- Insert March 2026 fuel consumption data
-- Using correct vehicle IDs from the database

INSERT INTO fuel_consumption (fuel_code, submitted_by, vehicle_id, liters, fuel_type, cost_pesos, date_recorded, created_at, updated_at)
VALUES
-- Hector Alejandro Hidalgo (5 transactions)
('FCO-2026-03-001', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 65.00, 'gasoline', 76700, '2026-03-02', NOW(), NOW()),
('FCO-2026-03-002', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 45.00, 'diesel', 50400, '2026-03-05', NOW(), NOW()),
('FCO-2026-03-003', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 50.00, 'gasoline', 58800, '2026-03-08', NOW(), NOW()),
('FCO-2026-03-004', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), '18a80f4e-9bfb-473b-9df1-686d30001abc', 75.00, 'diesel', 82800, '2026-03-12', NOW(), NOW()),
('FCO-2026-03-005', (SELECT id FROM employees WHERE name = 'Hector Alejandro Hidalgo' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 40.00, 'gasoline', 47200, '2026-03-15', NOW(), NOW()),

-- Cristian XXX (6 transactions)
('FCO-2026-03-006', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 55.00, 'diesel', 61600, '2026-03-03', NOW(), NOW()),
('FCO-2026-03-007', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 70.00, 'gasoline', 82600, '2026-03-06', NOW(), NOW()),
('FCO-2026-03-008', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 50.00, 'diesel', 56000, '2026-03-09', NOW(), NOW()),
('FCO-2026-03-009', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 60.00, 'gasoline', 70800, '2026-03-13', NOW(), NOW()),
('FCO-2026-03-010', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), '18a80f4e-9bfb-473b-9df1-686d30001abc', 45.00, 'diesel', 50400, '2026-03-16', NOW(), NOW()),
('FCO-2026-03-011', (SELECT id FROM employees WHERE name = 'Cristian XXX' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 55.00, 'gasoline', 64900, '2026-03-19', NOW(), NOW()),

-- Luis Miranda (5 transactions)
('FCO-2026-03-012', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 50.00, 'gasoline', 58800, '2026-03-04', NOW(), NOW()),
('FCO-2026-03-013', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), '4575fc62-5ff5-433f-a548-dc9913265254', 35.00, 'diesel', 39200, '2026-03-07', NOW(), NOW()),
('FCO-2026-03-014', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 60.00, 'gasoline', 70800, '2026-03-10', NOW(), NOW()),
('FCO-2026-03-015', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 45.00, 'diesel', 50400, '2026-03-14', NOW(), NOW()),
('FCO-2026-03-016', (SELECT id FROM employees WHERE name = 'Luis Miranda' LIMIT 1), 'bbe006c9-e06d-40c6-aca7-9bf7601967fc', 55.00, 'gasoline', 64900, '2026-03-18', NOW(), NOW()),

-- Seba Corcovado (5 transactions)
('FCO-2026-03-017', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 60.00, 'diesel', 67200, '2026-03-01', NOW(), NOW()),
('FCO-2026-03-018', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 45.00, 'gasoline', 53100, '2026-03-11', NOW(), NOW()),
('FCO-2026-03-019', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), '18a80f4e-9bfb-473b-9df1-686d30001abc', 50.00, 'diesel', 56000, '2026-03-17', NOW(), NOW()),
('FCO-2026-03-020', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 40.00, 'gasoline', 47200, '2026-03-20', NOW(), NOW()),
('FCO-2026-03-021', (SELECT id FROM employees WHERE name = 'Seba Corcovado' LIMIT 1), '4575fc62-5ff5-433f-a548-dc9913265254', 50.00, 'diesel', 56000, '2026-03-22', NOW(), NOW()),

-- Andres Sandoval (5 transactions)
('FCO-2026-03-022', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 80.00, 'gasoline', 94400, '2026-03-21', NOW(), NOW()),
('FCO-2026-03-023', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'eb0d4f5c-bca8-47de-b7be-a4c771b46083', 55.00, 'diesel', 61600, '2026-03-23', NOW(), NOW()),
('FCO-2026-03-024', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'bc39fbd0-b741-49ae-9681-0ecd5f0cc27a', 60.00, 'diesel', 67200, '2026-03-24', NOW(), NOW()),
('FCO-2026-03-025', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 70.00, 'gasoline', 82600, '2026-03-25', NOW(), NOW()),
('FCO-2026-03-026', (SELECT id FROM employees WHERE name = 'Andres Sandoval' LIMIT 1), 'bd9a70f7-617e-47d7-a1ad-e8b5c6d9e7ce', 45.00, 'gasoline', 53100, '2026-03-26', NOW(), NOW()),

-- Raimundo Colvin (5 transactions)
('FCO-2026-03-027', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), '18a80f4e-9bfb-473b-9df1-686d30001abc', 65.00, 'diesel', 72800, '2026-03-27', NOW(), NOW()),
('FCO-2026-03-028', (SELECT id FROM employees WHERE name = 'Raimundo Colvin' LIMIT 1), 'd7f449cd-de23-4f84-b9ca-c359f9395bc4', 55.00, 'gasoline', 64900, '2026-03-28', NOW(), NOW());

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
