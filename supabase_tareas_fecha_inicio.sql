-- Añadir fecha de inicio a tareas (para rango inicio→deadline en el calendario)
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_inicio_tarea date;
