-- Deshabilitar RLS temporalmente para permitir acceso sin autenticación
-- Esto permite que la aplicación funcione mientras se implementa auth

ALTER TABLE cattle_animals DISABLE ROW LEVEL SECURITY;
ALTER TABLE cattle_biometric_records DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está deshabilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('cattle_animals', 'cattle_biometric_records')
ORDER BY tablename;
