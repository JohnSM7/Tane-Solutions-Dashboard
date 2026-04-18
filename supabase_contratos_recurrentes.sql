-- Añade columna ultima_facturacion a contratos para tracking de facturación recurrente
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS ultima_facturacion date;
