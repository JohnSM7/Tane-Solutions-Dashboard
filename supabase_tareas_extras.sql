-- ============================================================
-- TAREAS EXTRAS: subtareas + comentarios
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Subtareas (checklist por tarea)
CREATE TABLE IF NOT EXISTS subtareas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id    uuid REFERENCES tareas(id) ON DELETE CASCADE NOT NULL,
  titulo      text NOT NULL,
  completada  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE subtareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subtareas_admin_all" ON subtareas FOR ALL
  USING (get_my_role() = 'ADMIN');

CREATE INDEX IF NOT EXISTS subtareas_tarea_idx ON subtareas(tarea_id);

-- Comentarios por tarea
CREATE TABLE IF NOT EXISTS comentarios_tareas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id       uuid REFERENCES tareas(id) ON DELETE CASCADE NOT NULL,
  usuario_id     uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  usuario_nombre text NOT NULL DEFAULT '',
  contenido      text NOT NULL,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE comentarios_tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios_admin_all" ON comentarios_tareas FOR ALL
  USING (get_my_role() = 'ADMIN');

CREATE INDEX IF NOT EXISTS comentarios_tarea_idx ON comentarios_tareas(tarea_id);
