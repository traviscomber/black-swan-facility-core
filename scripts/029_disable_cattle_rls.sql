-- Deshabilitar RLS temporalmente para permitir acceso sin autenticación
-- Esto permite que la aplicación funcione mientras se implementa auth

ALTER TABLE cattle_animals DISABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_biometric_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE feeding_recommendations DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está deshabilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cattle_animals', 'cattle_biometric_records', 'health_alerts', 'treatment_plans', 'feeding_recommendations')
ORDER BY tablename;
