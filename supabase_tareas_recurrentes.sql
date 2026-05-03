-- Tareas recurrentes: agrupar instancias con recurrencia_id
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recurrencia_id       uuid;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS es_recurrente        boolean NOT NULL DEFAULT false;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS frecuencia_recurrencia text
  CHECK (frecuencia_recurrencia IN ('diaria', 'semanal', 'quincenal', 'mensual'));

CREATE INDEX IF NOT EXISTS tareas_recurrencia_idx ON tareas(recurrencia_id);
