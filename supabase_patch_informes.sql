-- ─────────────────────────────────────────────────────────────────────────────
-- Tane Solutions · Parche: Módulo de Informes de Cliente
-- Ejecutar una sola vez sobre la base de datos de producción.
-- Requiere que el parche supabase_schema_v2.sql ya esté aplicado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabla principal de informes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS informes (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id           uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo               text NOT NULL,
  descripcion_ejecutiva text,           -- Resumen ejecutivo visible al cliente
  resumen_trabajo      text,            -- Descripción detallada del trabajo realizado
  periodo_inicio       date,
  periodo_fin          date,
  creado_por           text,            -- Nombre del redactor (agencia)
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "admin_all_informes" ON informes
  FOR ALL
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

-- Cliente: solo lectura de sus propios informes
CREATE POLICY "client_read_informes" ON informes
  FOR SELECT
  USING (
    get_my_role() = 'CLIENT'
    AND cliente_id = get_my_client_id()
  );

-- ── Tabla de archivos NAS por informe ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS informe_archivos_nas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  informe_id  uuid NOT NULL REFERENCES informes(id) ON DELETE CASCADE,
  nombre      text NOT NULL,             -- Nombre legible del archivo
  url_nas     text NOT NULL,             -- URL directa al archivo en el NAS
  tipo        text NOT NULL DEFAULT 'otro',  -- pdf | word | excel | imagen | video | zip | otro
  descripcion text,                      -- Descripción breve opcional
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE informe_archivos_nas ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "admin_all_archivos_nas" ON informe_archivos_nas
  FOR ALL
  USING (get_my_role() = 'ADMIN')
  WITH CHECK (get_my_role() = 'ADMIN');

-- Cliente: lectura de archivos de sus propios informes
CREATE POLICY "client_read_archivos_nas" ON informe_archivos_nas
  FOR SELECT
  USING (
    get_my_role() = 'CLIENT'
    AND informe_id IN (
      SELECT id FROM informes WHERE cliente_id = get_my_client_id()
    )
  );
