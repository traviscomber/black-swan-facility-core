-- Insertar animales Angus de prueba basados en reportes veterinarios Valdivia NOV-DIC 2025
-- Grupo 1 (8 vacas)
INSERT INTO cattle_animals (farm_id, animal_id, name, breed, gender, birth_date, status)
SELECT 
  id as farm_id,
  '22027424' as animal_id,
  'Vaca Angus 22027424' as name,
  'Angus' as breed,
  'female' as gender,
  '2020-03-15'::DATE as birth_date,
  'active' as status
FROM farms LIMIT 1
ON CONFLICT (animal_id) DO NOTHING;

INSERT INTO cattle_animals (farm_id, animal_id, name, breed, gender, birth_date, status)
SELECT 
  id as farm_id,
  '23526062' as animal_id,
  'Vaquilla Angus 23526062' as name,
  'Angus' as breed,
  'female' as gender,
  '2021-05-20'::DATE as birth_date,
  'active' as status
FROM farms LIMIT 1
ON CONFLICT (animal_id) DO NOTHING;

-- Más animales Angus de prueba para el grupo
INSERT INTO cattle_animals (farm_id, animal_id, name, breed, gender, birth_date, status)
SELECT 
  id as farm_id,
  CONCAT('ANG-', LPAD(CAST((1000 + (i % 100)) AS TEXT), 6, '0')) as animal_id,
  CONCAT('Vaca Angus ', LPAD(CAST((1000 + (i % 100)) AS TEXT), 6, '0')) as name,
  'Angus' as breed,
  'female' as gender,
  (CURRENT_DATE - INTERVAL '1' DAY * (365 * 3 + i))::DATE as birth_date,
  'active' as status
FROM farms, LATERAL generate_series(1, 8) as gs(i)
WHERE NOT EXISTS (SELECT 1 FROM cattle_animals WHERE breed = 'Angus')
ON CONFLICT (animal_id) DO NOTHING;
