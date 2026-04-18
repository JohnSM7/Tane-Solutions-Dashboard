-- ============================================================
-- TANE SOLUTIONS — Módulo de Contratos
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS contratos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       uuid REFERENCES clientes(id) ON DELETE CASCADE,
  nombre           text NOT NULL,
  tipo             text DEFAULT 'Mensual'
    CHECK (tipo IN ('Mensual','Anual','Puntual','Retainer')),
  valor_mensual    numeric DEFAULT 0,
  fecha_inicio     date NOT NULL DEFAULT current_date,
  fecha_renovacion date,
  estado           text DEFAULT 'Activo'
    CHECK (estado IN ('Activo','Pausado','Cancelado')),
  notas            text DEFAULT '',
  creado_en        timestamptz DEFAULT now()
);

ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_admin_all" ON contratos;
CREATE POLICY "contratos_admin_all" ON contratos FOR ALL USING (get_my_role() = 'ADMIN');
