-- Verificar y limpiar datos existentes
DELETE FROM cattle_biometric_records WHERE animal_id LIKE '%22027424%' OR animal_id LIKE '%23526062%' OR animal_id LIKE '%ANG-%';
DELETE FROM cattle_animals WHERE animal_id LIKE '%22027424%' OR animal_id LIKE '%23526062%' OR animal_id LIKE '%ANG-%';

-- Insertar animales Angus de Valdivia - Script robusto con validación
WITH farm_check AS (
  SELECT 'Blackswan Valdivia' as farm_name, 
         COALESCE((SELECT id FROM cattle_animals LIMIT 1), '550e8400-e29b-41d4-a716-446655440000'::uuid) as default_farm_id
)
INSERT INTO cattle_animals (farm_id, animal_id, name, breed, gender, birth_date, status, created_at)
SELECT 
  '550e8400-e29b-41d4-a716-446655440000'::uuid as farm_id,
  animal_data.animal_id,
  animal_data.name,
  'Angus' as breed,
  'female' as gender,
  animal_data.birth_date,
  'active' as status,
  now() as created_at
FROM (VALUES 
  ('22027424', 'Vaca Angus 22027424', '2020-03-15'::DATE),
  ('23526062', 'Vaquilla Angus 23526062', '2021-05-20'::DATE),
  ('ANG-001001', 'Vaca Angus 001001', '2019-06-10'::DATE),
  ('ANG-001002', 'Vaca Angus 001002', '2020-01-22'::DATE),
  ('ANG-001003', 'Vaca Angus 001003', '2020-08-14'::DATE),
  ('ANG-001004', 'Vaca Angus 001004', '2021-02-03'::DATE),
  ('ANG-001005', 'Vaca Angus 001005', '2021-07-18'::DATE),
  ('ANG-001006', 'Vaquilla Angus 001006', '2022-04-27'::DATE),
  ('ANG-001007', 'Vaquilla Angus 001007', '2022-09-15'::DATE),
  ('ANG-001008', 'Vaquilla Angus 001008', '2023-03-08'::DATE)
) AS animal_data(animal_id, name, birth_date)
ON CONFLICT (animal_id) DO UPDATE SET 
  status = 'active',
  updated_at = now();

-- Verificar que se insertaron correctamente
SELECT COUNT(*) as total_animals, 
       COUNT(CASE WHEN breed = 'Angus' THEN 1 END) as angus_count
FROM cattle_animals;
