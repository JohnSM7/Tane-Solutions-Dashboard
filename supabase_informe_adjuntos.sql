-- ══════════════════════════════════════════════════════════════════════════
-- Archivos adjuntos a informes de trabajo
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS informe_adjuntos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id   uuid NOT NULL REFERENCES informes(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  url          text NOT NULL,
  storage_path text NOT NULL,
  tipo         text NOT NULL DEFAULT 'otro',
  tamanio      bigint,
  subido_por   text DEFAULT 'admin',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_informe_adjuntos_informe ON informe_adjuntos(informe_id);

ALTER TABLE informe_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adjuntos_admin_all"    ON informe_adjuntos;
DROP POLICY IF EXISTS "adjuntos_client_read"  ON informe_adjuntos;

CREATE POLICY "adjuntos_admin_all" ON informe_adjuntos
  FOR ALL USING (get_my_role() = 'ADMIN');

-- Clientes leen los adjuntos de sus propios informes
CREATE POLICY "adjuntos_client_read" ON informe_adjuntos
  FOR SELECT USING (
    get_my_role() = 'CLIENT'
    AND informe_id IN (
      SELECT id FROM informes WHERE cliente_id = get_my_client_id()
    )
  );

-- Storage: el bucket "informes" ya existe. Solo añadimos política para adjuntos.
-- Si aún no existe la política de lectura pública, créala:
DROP POLICY IF EXISTS "adjuntos_public_read" ON storage.objects;
CREATE POLICY "adjuntos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'informes');
