-- Diagnóstico: Verificar datos en tablas de ganado
-- Este script verifica si hay datos realmente guardados

SELECT 'cattle_animals' as tabla, COUNT(*) as total_registros FROM cattle_animals
UNION ALL
SELECT 'cattle_biometric_records', COUNT(*) FROM cattle_biometric_records;

-- Mostrar primeros 5 animales
SELECT id, animal_id, name, breed, status FROM cattle_animals LIMIT 5;

-- Mostrar primeros 5 registros de análisis
SELECT id, animal_id, test_date, bhb, total_protein, magnesium FROM cattle_biometric_records LIMIT 5;

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('cattle_animals', 'cattle_biometric_records')
ORDER BY tablename, policyname;
