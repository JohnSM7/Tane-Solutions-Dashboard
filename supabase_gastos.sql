-- Ejecutar en: https://supabase.com/dashboard/project/idogljsfqunkvmvvnyrx/sql/new

CREATE TABLE IF NOT EXISTS gastos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES proyectos_rentabilidad(id) ON DELETE CASCADE,
  concepto    text NOT NULL,
  importe     numeric(10,2) NOT NULL CHECK (importe > 0),
  categoria   text NOT NULL DEFAULT 'Otro',
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_proyecto_id_idx ON gastos(proyecto_id);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver y gestionar gastos (datos internos de rentabilidad)
CREATE POLICY "Admin full access to gastos"
  ON gastos FOR ALL
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');
