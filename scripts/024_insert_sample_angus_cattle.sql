-- Insertar animales Angus de prueba basados en reportes veterinarios Valdivia NOV-DIC 2025
-- Usamos un farm_id fijo para Blackswan Valdivia
-- En producción, este farm_id vendría del sistema de propiedades

INSERT INTO cattle_animals (farm_id, animal_id, name, breed, gender, birth_date, status, created_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', '22027424', 'Vaca Angus 22027424', 'Angus', 'female', '2020-03-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', '23526062', 'Vaquilla Angus 23526062', 'Angus', 'female', '2021-05-20'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001001', 'Vaca Angus 001001', 'Angus', 'female', '2019-06-10'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001002', 'Vaca Angus 001002', 'Angus', 'female', '2020-01-22'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001003', 'Vaca Angus 001003', 'Angus', 'female', '2020-08-14'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001004', 'Vaca Angus 001004', 'Angus', 'female', '2021-02-03'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001005', 'Vaca Angus 001005', 'Angus', 'female', '2021-07-18'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001006', 'Vaquilla Angus 001006', 'Angus', 'female', '2022-04-27'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001007', 'Vaquilla Angus 001007', 'Angus', 'female', '2022-09-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000', 'ANG-001008', 'Vaquilla Angus 001008', 'Angus', 'female', '2023-03-08'::DATE, 'active', now())
ON CONFLICT (animal_id) DO NOTHING;
