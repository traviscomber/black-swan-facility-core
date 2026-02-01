-- Agregar políticas RLS para acceso a tablas de salud animal
-- Estas políticas permiten a usuarios autenticados leer y escribir sus propios datos

-- Políticas para cattle_animals
CREATE POLICY "Allow authenticated users to read all cattle animals" 
ON cattle_animals FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert cattle animals" 
ON cattle_animals FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update cattle animals" 
ON cattle_animals FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- Políticas para cattle_biometric_records
CREATE POLICY "Allow authenticated users to read all biometric records" 
ON cattle_biometric_records FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert biometric records" 
ON cattle_biometric_records FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update biometric records" 
ON cattle_biometric_records FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete biometric records" 
ON cattle_biometric_records FOR DELETE 
TO authenticated 
USING (true);

-- Políticas para cattle_health_alerts
CREATE POLICY "Allow authenticated users to read health alerts" 
ON cattle_health_alerts FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert health alerts" 
ON cattle_health_alerts FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Políticas para cattle_treatment_plans
CREATE POLICY "Allow authenticated users to read treatment plans" 
ON cattle_treatment_plans FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert treatment plans" 
ON cattle_treatment_plans FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Políticas para cattle_body_condition_history
CREATE POLICY "Allow authenticated users to read body condition history" 
ON cattle_body_condition_history FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert body condition records" 
ON cattle_body_condition_history FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Políticas para cattle_feeding_recommendations
CREATE POLICY "Allow authenticated users to read feeding recommendations" 
ON cattle_feeding_recommendations FOR SELECT 
TO authenticated 
USING (true);
