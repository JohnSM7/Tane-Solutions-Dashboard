-- ═══════════════════════════════════════════════════════════════
-- Tabla: informes de trabajo para clientes
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS informes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id   UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  proyecto     TEXT NOT NULL DEFAULT '',
  periodo      TEXT DEFAULT '',
  url_pdf      TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  generado_por TEXT DEFAULT 'admin',
  creado_en    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_informes_cliente ON informes(cliente_id);

-- RLS
ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

-- Admins ven todos los informes
CREATE POLICY "Admins ven todos los informes"
  ON informes FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'ADMIN')
  );

-- Clientes ven solo sus informes
CREATE POLICY "Clientes ven sus informes"
  ON informes FOR SELECT
  TO authenticated
  USING (
    cliente_id IN (SELECT u.cliente_id FROM usuarios u WHERE u.id = auth.uid())
  );

-- Admins insertan informes
CREATE POLICY "Admins insertan informes"
  ON informes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'ADMIN')
  );

-- Admins eliminan informes
CREATE POLICY "Admins eliminan informes"
  ON informes FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'ADMIN')
  );

-- ═══════════════════════════════════════════════════════════════
-- Storage: bucket para informes PDF
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('informes', 'informes', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura para autenticados
CREATE POLICY "Lectura publica de informes PDF"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'informes');

-- Solo admins suben
CREATE POLICY "Admins suben informes PDF"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'informes'
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'ADMIN')
  );

-- Solo admins borran
CREATE POLICY "Admins borran informes PDF"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'informes'
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.rol = 'ADMIN')
  );
