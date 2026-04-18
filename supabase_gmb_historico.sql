-- ============================================================
-- TANE SOLUTIONS — Histórico GMB
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS gmb_snapshots (
  id           bigserial PRIMARY KEY,
  sede_id      bigint REFERENCES sedes(id) ON DELETE CASCADE,
  cliente_id   uuid REFERENCES clientes(id) ON DELETE CASCADE,
  fecha        date NOT NULL DEFAULT current_date,
  gmb_rating   numeric(2,1) DEFAULT 0,
  gmb_reviews  integer DEFAULT 0,
  gmb_unanswered integer DEFAULT 0,
  gmb_pub_views  integer DEFAULT 0,
  creado_en    timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gmb_snapshots_sede_fecha
  ON gmb_snapshots (sede_id, fecha);

ALTER TABLE gmb_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gmb_snapshots_admin_all" ON gmb_snapshots;
CREATE POLICY "gmb_snapshots_admin_all" ON gmb_snapshots FOR ALL USING (get_my_role() = 'ADMIN');
