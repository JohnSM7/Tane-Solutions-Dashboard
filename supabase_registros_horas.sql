-- Registro de horas dedicadas por tarea/proyecto/trabajador
-- Ejecutar en Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS registros_horas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id    uuid REFERENCES tareas(id) ON DELETE CASCADE,
  proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  fecha       date NOT NULL DEFAULT current_date,
  horas       numeric(5,2) NOT NULL CHECK (horas > 0),
  descripcion text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE registros_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_admin_all" ON registros_horas FOR ALL
  USING (get_my_role() = 'ADMIN');

CREATE INDEX IF NOT EXISTS rh_tarea_idx    ON registros_horas(tarea_id);
CREATE INDEX IF NOT EXISTS rh_proyecto_idx ON registros_horas(proyecto_id);
CREATE INDEX IF NOT EXISTS rh_usuario_idx  ON registros_horas(usuario_id);
