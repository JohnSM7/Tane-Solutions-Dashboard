-- ============================================================
-- TAREAS — Kanban board vinculado a proyectos y leads
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS tareas (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo            text NOT NULL,
  descripcion       text,
  estado            text NOT NULL DEFAULT 'backlog'
                    CHECK (estado IN ('backlog', 'en_progreso', 'revision', 'completado')),
  prioridad         text NOT NULL DEFAULT 'Media'
                    CHECK (prioridad IN ('Baja', 'Media', 'Alta')),
  proyecto_id       uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  lead_id           uuid REFERENCES leads(id) ON DELETE SET NULL,
  asignado_a        uuid REFERENCES miembros_equipo(id) ON DELETE SET NULL,
  horas_estimadas   numeric(5,1) DEFAULT 0,
  fecha_limite      date,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_tareas"
  ON tareas FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Índices útiles
CREATE INDEX IF NOT EXISTS tareas_estado_idx      ON tareas(estado);
CREATE INDEX IF NOT EXISTS tareas_asignado_a_idx  ON tareas(asignado_a);
CREATE INDEX IF NOT EXISTS tareas_proyecto_id_idx ON tareas(proyecto_id);
