-- ============================================================
-- PATCH: Vincular facturas a proyectos + número de factura
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Añadir número de factura y vínculo a proyecto
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS numero_factura  text,
  ADD COLUMN IF NOT EXISTS proyecto_id     uuid REFERENCES proyectos_rentabilidad(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pago_numero     integer DEFAULT 1,   -- ej: 1 de 2
  ADD COLUMN IF NOT EXISTS pago_total      integer DEFAULT 1;   -- ej: 2 de 2

-- 2. Plan de pago en el proyecto
ALTER TABLE proyectos_rentabilidad
  ADD COLUMN IF NOT EXISTS plan_pago text DEFAULT '100'
    CHECK (plan_pago IN ('100', '50/50', '40/60', '33/33/34', 'personalizado'));

-- 3. Índice para buscar facturas por proyecto rápido
CREATE INDEX IF NOT EXISTS idx_facturas_proyecto ON facturas(proyecto_id);
