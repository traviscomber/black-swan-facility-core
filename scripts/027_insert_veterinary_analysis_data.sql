-- Insertar datos de análisis bioquímicos de reportes veterinarios Valdivia 2025
-- Grupo 1: 8 vacas (Laboratorio 72-26, 13-01-2026)
-- Grupo 2: 9 vaquillas (Laboratorio 72-26, 13-01-2026)

INSERT INTO cattle_biometric_records (animal_id, test_date, bhb, total_protein, magnesium, calcium, glucose, notes, created_at)
SELECT id, '2026-01-13'::DATE, bhb, protein, mg, ca, null, notes, now()
FROM (
  -- Grupo 1: Vacas
  SELECT a.id, 0.51::DECIMAL, 84::DECIMAL, 0.75::DECIMAL, 2.33::DECIMAL, 'Vaca 1 - Movilización grasa, bajo aporte proteico, hipomagnesemia' as notes
  FROM cattle_animals a WHERE a.animal_id = '22027491'
  UNION ALL
  SELECT a.id, 0.43::DECIMAL, 76::DECIMAL, 0.48::DECIMAL, 2.32::DECIMAL, 'Vaca 2'
  FROM cattle_animals a WHERE a.animal_id = '22027519'
  UNION ALL
  SELECT a.id, 0.64::DECIMAL, 85::DECIMAL, 0.62::DECIMAL, 2.33::DECIMAL, 'Vaca 3'
  FROM cattle_animals a WHERE a.animal_id = '25096938'
  UNION ALL
  SELECT a.id, 0.55::DECIMAL, 122::DECIMAL, 0.61::DECIMAL, 2.27::DECIMAL, 'Vaca 22027424 - Proceso infeccioso inespecífico'
  FROM cattle_animals a WHERE a.animal_id = '22027424'
  UNION ALL
  SELECT a.id, 0.67::DECIMAL, 85::DECIMAL, 0.69::DECIMAL, 2.28::DECIMAL, 'Vaca 5'
  FROM cattle_animals a WHERE a.animal_id = '23526074'
  UNION ALL
  SELECT a.id, 0.57::DECIMAL, 81::DECIMAL, 0.71::DECIMAL, 2.32::DECIMAL, 'Vaca 6'
  FROM cattle_animals a WHERE a.animal_id = '22027509'
  UNION ALL
  SELECT a.id, 0.44::DECIMAL, 77::DECIMAL, 0.66::DECIMAL, 2.32::DECIMAL, 'Vaca 7'
  FROM cattle_animals a WHERE a.animal_id = '22027628'
  UNION ALL
  SELECT a.id, 0.62::DECIMAL, 78::DECIMAL, 0.64::DECIMAL, 2.34::DECIMAL, 'Vaca 8'
  FROM cattle_animals a WHERE a.animal_id = '19043799'
  
  -- Grupo 2: Vaquillas  
  UNION ALL
  SELECT a.id, 0.38::DECIMAL, 75::DECIMAL, 0.60::DECIMAL, 2.32::DECIMAL, 'Vaquilla 1'
  FROM cattle_animals a WHERE a.animal_id = '26430331'
  UNION ALL
  SELECT a.id, 0.44::DECIMAL, 69::DECIMAL, 0.59::DECIMAL, 2.42::DECIMAL, 'Vaquilla 2'
  FROM cattle_animals a WHERE a.animal_id = '26450205'
  UNION ALL
  SELECT a.id, 0.64::DECIMAL, 71::DECIMAL, 0.62::DECIMAL, 2.43::DECIMAL, 'Vaquilla 3'
  FROM cattle_animals a WHERE a.animal_id = '26430425'
  UNION ALL
  SELECT a.id, 0.54::DECIMAL, 81::DECIMAL, 0.54::DECIMAL, 2.40::DECIMAL, 'Vaquilla 4'
  FROM cattle_animals a WHERE a.animal_id = '23556078'
  UNION ALL
  SELECT a.id, 0.51::DECIMAL, 73::DECIMAL, 0.56::DECIMAL, 2.42::DECIMAL, 'Vaquilla 5'
  FROM cattle_animals a WHERE a.animal_id = '26430935'
  UNION ALL
  SELECT a.id, 0.48::DECIMAL, 97::DECIMAL, 0.68::DECIMAL, 2.36::DECIMAL, 'Vaquilla 23526062 - Proceso infeccioso inespecífico'
  FROM cattle_animals a WHERE a.animal_id = '23526062'
  UNION ALL
  SELECT a.id, 0.55::DECIMAL, 76::DECIMAL, 0.56::DECIMAL, 2.71::DECIMAL, 'Vaquilla 7'
  FROM cattle_animals a WHERE a.animal_id = '26430429'
  UNION ALL
  SELECT a.id, 0.53::DECIMAL, 74::DECIMAL, 0.54::DECIMAL, 2.40::DECIMAL, 'Vaquilla 8'
  FROM cattle_animals a WHERE a.animal_id = '26430423'
  UNION ALL
  SELECT a.id, 0.51::DECIMAL, 64::DECIMAL, 0.67::DECIMAL, 2.42::DECIMAL, 'Vaquilla 9'
  FROM cattle_animals a WHERE a.animal_id = '23556076'
) data(id, bhb, protein, mg, ca, notes)
WHERE id IS NOT NULL
ON CONFLICT DO NOTHING;
