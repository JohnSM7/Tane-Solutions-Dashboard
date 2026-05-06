-- ============================================================
-- PATCH: Campos de contacto en clientes
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS telefono       text DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_contacto text DEFAULT '';
