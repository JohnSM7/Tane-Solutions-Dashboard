-- Tabla de suscripciones / mantenimientos recurrentes
CREATE TABLE IF NOT EXISTS suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  proyecto_id uuid REFERENCES proyectos_rentabilidad(id) ON DELETE SET NULL,
  concepto text NOT NULL,
  importe numeric NOT NULL DEFAULT 0,
  tipo_iva integer NOT NULL DEFAULT 21,
  frecuencia text NOT NULL DEFAULT 'mensual'
    CHECK (frecuencia IN ('mensual', 'trimestral', 'semestral', 'anual')),
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_ultimo_pago date,
  estado text NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'pausada', 'cancelada')),
  notas text,
  created_at timestamptz DEFAULT now()
);

-- Vincular facturas a suscripciones (opcional, no rompe nada existente)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS suscripcion_id uuid REFERENCES suscripciones(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suscripciones" ON suscripciones
  FOR ALL USING (get_my_role() = 'ADMIN');
