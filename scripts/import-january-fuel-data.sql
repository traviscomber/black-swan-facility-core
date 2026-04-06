-- Import January 2026 Fuel Consumption Data
-- This script inserts 97 fuel consumption records for January 2026

INSERT INTO fuel_consumption (date, employee_id, vehicle_id, fuel_type, liters) VALUES
-- 2026-01-04
('2026-01-04', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 50),
('2026-01-04', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 30),
('2026-01-04', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lancha aluminio'), 'Bencina', 15),

-- 2026-01-05
('2026-01-05', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Buggy 2'), 'Bencina', 30),
('2026-01-05', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-05', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Desbrozadora'), 'Bencina', 5),
('2026-01-05', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 30),
('2026-01-05', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 30),
('2026-01-05', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lancha aluminio'), 'Bencina', 10),

-- 2026-01-06
('2026-01-06', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),
('2026-01-06', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Bote aluminio'), 'Bencina', 15),
('2026-01-06', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor Massey Ferguson'), 'Petróleo', 114),
('2026-01-06', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor New Holland'), 'Petróleo', 62),

-- 2026-01-07
('2026-01-07', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Retro'), 'Petróleo', 50),
('2026-01-07', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 60),
('2026-01-07', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lancha aluminio'), 'Bencina', 15),

-- 2026-01-08
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Cuatrimoto roja'), 'Bencina', 5),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Bote aluminio'), 'Bencina', 12),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE 'Ruben%'), (SELECT id FROM vehicles WHERE name ILIKE 'Chipiadora'), 'Bencina', 5),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor New Holland'), 'Petróleo', 100),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor Massey Ferguson'), 'Petróleo', 50),
('2026-01-08', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Maxus'), 'Petróleo', 50),

-- 2026-01-09
('2026-01-09', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Bote aluminio'), 'Bencina', 12),
('2026-01-09', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Retro constructora'), 'Petróleo', 132.42),

-- 2026-01-10
('2026-01-10', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Buggy'), 'Bencina', 20),
('2026-01-10', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Generador hotelito'), 'Bencina', 5),
('2026-01-10', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),
('2026-01-10', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Fomo 1'), 'Bencina', 15),

-- 2026-01-12
('2026-01-12', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-12', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Nissan Navara'), 'Petróleo', 60),
('2026-01-12', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),
('2026-01-12', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Bote aluminio'), 'Bencina', 12),

-- 2026-01-13
('2026-01-13', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Camioneta Wingle'), 'Bencina', 50),
('2026-01-13', (SELECT id FROM employees WHERE name ILIKE '%5195%'), (SELECT id FROM vehicles WHERE name ILIKE 'Moto 1'), 'Bencina', 7),
('2026-01-13', (SELECT id FROM employees WHERE name ILIKE '%5195%'), (SELECT id FROM vehicles WHERE name ILIKE 'Moto 2'), 'Bencina', 7),
('2026-01-13', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-13', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Cuatrimoto roja'), 'Bencina', 5),

-- 2026-01-14
('2026-01-14', (SELECT id FROM employees WHERE name ILIKE '%5195%'), (SELECT id FROM vehicles WHERE name ILIKE 'Buggy'), 'Bencina', 25),
('2026-01-14', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 40),

-- 2026-01-15
('2026-01-15', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 20),
('2026-01-15', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),

-- 2026-01-16
('2026-01-16', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-16', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 50),
('2026-01-16', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 15),
('2026-01-16', (SELECT id FROM employees WHERE name ILIKE 'Ruben%'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 40),

-- 2026-01-17
('2026-01-17', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Maxus'), 'Petróleo', 65),
('2026-01-17', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Nissan Navara'), 'Petróleo', 50),
('2026-01-17', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 40),
('2026-01-17', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 10),

-- 2026-01-19
('2026-01-19', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Barcaza Libe'), 'Petróleo', 160),
('2026-01-19', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Cuatrimoto'), 'Bencina', 5),
('2026-01-19', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-19', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 50),
('2026-01-19', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),
('2026-01-19', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 25),

-- 2026-01-21
('2026-01-21', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Buggy'), 'Bencina', 20),
('2026-01-21', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-21', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Cuatrimoto roja'), 'Bencina', 5),
('2026-01-21', (SELECT id FROM employees WHERE name ILIKE '%5195%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor azul'), 'Petróleo', 169),
('2026-01-21', (SELECT id FROM employees WHERE name ILIKE 'Ruben%'), (SELECT id FROM vehicles WHERE name ILIKE 'Chipiadora'), 'Bencina', 10),

-- 2026-01-22
('2026-01-22', (SELECT id FROM employees WHERE name ILIKE '%5195%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor azul'), 'Petróleo', 124),
('2026-01-22', (SELECT id FROM employees WHERE name ILIKE 'Ruben%'), (SELECT id FROM vehicles WHERE name ILIKE 'Desbrozadora jardín'), 'Bencina', 5),

-- 2026-01-23
('2026-01-23', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Generador'), 'Petróleo', 150),
('2026-01-23', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Maxus'), 'Petróleo', 40),

-- 2026-01-24
('2026-01-24', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Buggy'), 'Bencina', 20),
('2026-01-24', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-24', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Cuatrimoto roja'), 'Bencina', 5),
('2026-01-24', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 50),
('2026-01-24', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 10),

-- 2026-01-25
('2026-01-25', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Generador Honda'), 'Bencina', 20),

-- 2026-01-26
('2026-01-26', (SELECT id FROM employees WHERE name ILIKE 'Titan'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor azul'), 'Petróleo', 44),
('2026-01-26', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Retro constructora%'), 'Petróleo', 120),
('2026-01-26', (SELECT id FROM employees WHERE name ILIKE '%5195%'), (SELECT id FROM vehicles WHERE name ILIKE 'Tractor azul'), 'Petróleo', 66),

-- 2026-01-27
('2026-01-27', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Cuatrimoto roja'), 'Bencina', 5),
('2026-01-27', (SELECT id FROM employees WHERE name ILIKE '%hector%'), (SELECT id FROM vehicles WHERE name ILIKE 'Motobomba viñas'), 'Bencina', 5),
('2026-01-27', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Buggy azul'), 'Bencina', 25),

-- 2026-01-28
('2026-01-28', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Corcovado'), 'Bencina', 50),
('2026-01-28', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 30),

-- 2026-01-30
('2026-01-30', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Generador'), 'Petróleo', 60),
('2026-01-30', (SELECT id FROM employees WHERE name ILIKE 'Raimundo%'), (SELECT id FROM vehicles WHERE name ILIKE 'Generador'), 'Petróleo', 60),
('2026-01-30', (SELECT id FROM employees WHERE name ILIKE 'Manfred Corcovado'), (SELECT id FROM vehicles WHERE name ILIKE 'Nissan Navara'), 'Petróleo', 60),
('2026-01-30', (SELECT id FROM employees WHERE name ILIKE 'Luis Miranda'), (SELECT id FROM vehicles WHERE name ILIKE 'Lanchón'), 'Bencina', 15),

-- 2026-01-31
('2026-01-31', (SELECT id FROM employees WHERE name ILIKE 'Andres%'), (SELECT id FROM vehicles WHERE name ILIKE 'Generador'), 'Petróleo', 50);
