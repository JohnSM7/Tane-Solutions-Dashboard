-- ============================================================
-- PATCH: Datos fiscales de clientes + IVA en facturas
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Datos fiscales del cliente
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cif                   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS direccion_facturacion text DEFAULT '';

-- 2. IVA en facturas (tipo %, la cuota y total se calculan en app)
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS tipo_iva numeric DEFAULT 21;
