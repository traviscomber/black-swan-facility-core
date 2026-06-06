-- Sprint 1: Add WorkOrder fields to maintenance_tasks table
-- This migration extends the maintenance_tasks schema to support the new operational model

-- Add new columns if they don't exist
ALTER TABLE maintenance_tasks
ADD COLUMN IF NOT EXISTS tipo_trabajo VARCHAR(100),
ADD COLUMN IF NOT EXISTS duracion_estimada_minutos INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS duracion_real_minutos INTEGER,
ADD COLUMN IF NOT EXISTS recurrencia VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS checklist_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS evidencia_url TEXT,
ADD COLUMN IF NOT EXISTS prioridad VARCHAR(50) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS estado_extendido VARCHAR(50),
ADD COLUMN IF NOT EXISTS fecha_objetivo DATE,
ADD COLUMN IF NOT EXISTS fecha_completado TIMESTAMP,
ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT FALSE;

-- Create an index on fecha_objetivo for faster queries
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_fecha_objetivo 
ON maintenance_tasks(fecha_objetivo);

-- Create an index on estado_extendido for faster filtering
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_estado_extendido 
ON maintenance_tasks(estado_extendido);

-- Add comment to document the new structure
COMMENT ON TABLE maintenance_tasks IS 'Enhanced maintenance tasks (WorkOrder) table with operational support for Sprint 1';
