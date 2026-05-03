-- Asignación múltiple de tareas
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS asignados_ids uuid[] DEFAULT '{}';
