-- Eliminar todos los registros biométricos de prueba/mockup
DELETE FROM cattle_biometric_records;

-- Eliminar animales que no tenían análisis real (los primeros 10 de prueba)
DELETE FROM cattle_animals 
WHERE animal_id IN ('ANG-001001', 'ANG-001002', 'ANG-001003', 'ANG-001004', 'ANG-001005', 'ANG-001006', 'ANG-001007', 'ANG-001008');

-- Reinsertar SOLO los 17 animales del análisis real de Valdivia 23-01-2026
INSERT INTO cattle_animals (farm_id, animal_id, name, breed, gender, birth_date, status, created_at)
VALUES 
  -- Vacas con análisis real
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '22027424', 'Vaca Angus 22027424', 'Angus', 'female', '2020-03-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '22027491', 'Vaca Angus 22027491', 'Angus', 'female', '2020-04-20'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '22027519', 'Vaca Angus 22027519', 'Angus', 'female', '2020-05-10'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '25096938', 'Vaca Angus 25096938', 'Angus', 'female', '2020-06-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '23526074', 'Vaca Angus 23526074', 'Angus', 'female', '2020-07-20'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '22027509', 'Vaca Angus 22027509', 'Angus', 'female', '2020-08-10'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '22027628', 'Vaca Angus 22027628', 'Angus', 'female', '2020-09-05'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '19043799', 'Vaca Angus 19043799', 'Angus', 'female', '2019-09-15'::DATE, 'active', now()),
  
  -- Vaquillas con análisis real
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '23526062', 'Vaquilla Angus 23526062', 'Angus', 'female', '2021-05-20'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '26430331', 'Vaquilla Angus 26430331', 'Angus', 'female', '2021-03-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '26450205', 'Vaquilla Angus 26450205', 'Angus', 'female', '2021-04-20'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '26430425', 'Vaquilla Angus 26430425', 'Angus', 'female', '2021-05-10'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '23556078', 'Vaquilla Angus 23556078', 'Angus', 'female', '2021-06-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '26430935', 'Vaquilla Angus 26430935', 'Angus', 'female', '2021-07-20'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '26430429', 'Vaquilla Angus 26430429', 'Angus', 'female', '2021-08-10'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '26430423', 'Vaquilla Angus 26430423', 'Angus', 'female', '2021-09-15'::DATE, 'active', now()),
  ('550e8400-e29b-41d4-a716-446655440000'::uuid, '23556076', 'Vaquilla Angus 23556076', 'Angus', 'female', '2021-10-20'::DATE, 'active', now())
ON CONFLICT (animal_id) DO NOTHING;

-- Insertar SOLO los 17 análisis reales de Valdivia 23-01-2026
INSERT INTO cattle_biometric_records (animal_id, test_date, bhb, total_protein, magnesium, calcium, lab_notes, created_at)
SELECT id, '2026-01-23'::DATE, bhb, protein, mg, ca, notes, now()
FROM (
  -- Vacas
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '22027424'), 0.51::FLOAT, 84::FLOAT, 0.75::FLOAT, 2.33::FLOAT, 'Vaca 22027424 - Movilización grasa, bajo aporte proteico, hipomagnesemia'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '22027491'), 0.43::FLOAT, 76::FLOAT, 0.48::FLOAT, 2.32::FLOAT, 'Vaca 22027491 - Hipomagnesemia subclínica crítica'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '22027519'), 0.64::FLOAT, 85::FLOAT, 0.62::FLOAT, 2.33::FLOAT, 'Vaca 22027519 - Cetosis subclínica'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '25096938'), 0.55::FLOAT, 122::FLOAT, 0.61::FLOAT, 2.27::FLOAT, 'Vaca 25096938 - Proteína elevada por infección'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '23526074'), 0.67::FLOAT, 85::FLOAT, 0.69::FLOAT, 2.28::FLOAT, 'Vaca 23526074 - Cetosis moderada'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '22027509'), 0.57::FLOAT, 81::FLOAT, 0.71::FLOAT, 2.32::FLOAT, 'Vaca 22027509 - Desnutrición energética severa'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '22027628'), 0.44::FLOAT, 77::FLOAT, 0.66::FLOAT, 2.32::FLOAT, 'Vaca 22027628 - Hipomagnesemia con bajo BHB'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '19043799'), 0.62::FLOAT, 78::FLOAT, 0.64::FLOAT, 2.34::FLOAT, 'Vaca 19043799 - Cetosis y desnutrición severa'
  
  -- Vaquillas
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '23526062'), 0.38::FLOAT, 75::FLOAT, 0.60::FLOAT, 2.32::FLOAT, 'Vaquilla 23526062 - Proceso infeccioso inespecífico, BHB bajo'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '26430331'), 0.44::FLOAT, 69::FLOAT, 0.59::FLOAT, 2.42::FLOAT, 'Vaquilla 26430331 - Movilización grasa, proteína baja'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '26450205'), 0.64::FLOAT, 71::FLOAT, 0.62::FLOAT, 2.43::FLOAT, 'Vaquilla 26450205 - Cetosis subclínica severa'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '26430425'), 0.54::FLOAT, 81::FLOAT, 0.54::FLOAT, 2.40::FLOAT, 'Vaquilla 26430425 - Hipomagnesemia crítica'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '23556078'), 0.51::FLOAT, 73::FLOAT, 0.56::FLOAT, 2.42::FLOAT, 'Vaquilla 23556078 - Desnutrición proteica severa'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '26430935'), 0.48::FLOAT, 97::FLOAT, 0.68::FLOAT, 2.36::FLOAT, 'Vaquilla 26430935 - Proteína compensatoria, Mg normal'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '26430429'), 0.55::FLOAT, 76::FLOAT, 0.56::FLOAT, 2.71::FLOAT, 'Vaquilla 26430429 - Calcio elevado, proteína baja'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '26430423'), 0.53::FLOAT, 74::FLOAT, 0.54::FLOAT, 2.40::FLOAT, 'Vaquilla 26430423 - Hipomagnesemia severa'
  UNION ALL
  SELECT (SELECT id FROM cattle_animals WHERE animal_id = '23556076'), 0.51::FLOAT, 64::FLOAT, 0.67::FLOAT, 2.42::FLOAT, 'Vaquilla 23556076 - Proteína muy baja, Mg bajo'
) data(id, bhb, protein, mg, ca, notes)
WHERE id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verificar datos finales
SELECT COUNT(*) as total_animales, COUNT(DISTINCT animal_id) as animales_unicos FROM cattle_animals;
SELECT COUNT(*) as total_registros, DATE(MIN(test_date)) as fecha_min, DATE(MAX(test_date)) as fecha_max FROM cattle_biometric_records;
