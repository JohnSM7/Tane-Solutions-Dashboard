-- ══════════════════════════════════════════════════════════════════════════
-- Cuentas asociadas al cliente (credenciales)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cuentas_cliente (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo     text NOT NULL,
  url        text DEFAULT '',
  usuario    text DEFAULT '',
  password   text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_cliente ON cuentas_cliente(cliente_id);

ALTER TABLE cuentas_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cuentas_admin_all"   ON cuentas_cliente;
DROP POLICY IF EXISTS "cuentas_client_read" ON cuentas_cliente;

CREATE POLICY "cuentas_admin_all" ON cuentas_cliente
  FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "cuentas_client_read" ON cuentas_cliente
  FOR SELECT USING (
    get_my_role() = 'CLIENT'
    AND cliente_id = get_my_client_id()
  );
