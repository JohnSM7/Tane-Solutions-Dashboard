-- ============================================================
-- TANE SOLUTIONS DASHBOARD - Schema v2
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- 1. Borrar tabla de datos manuales (ya no necesaria)
DROP TABLE IF EXISTS datos_dashboard;

-- 2. Limpiar clientes: quitar campos JSONB manuales
ALTER TABLE clientes
  DROP COLUMN IF EXISTS propuestas,
  DROP COLUMN IF EXISTS financiero,
  DROP COLUMN IF EXISTS sedes,
  DROP COLUMN IF EXISTS documentos,
  DROP COLUMN IF EXISTS proyectos,
  DROP COLUMN IF EXISTS usuarios;

-- ============================================================
-- 3. TABLAS NUEVAS
-- ============================================================

-- SEDES (ubicaciones del cliente)
CREATE TABLE IF NOT EXISTS sedes (
  id               bigserial PRIMARY KEY,
  cliente_id       uuid REFERENCES clientes(id) ON DELETE CASCADE,
  nombre           text NOT NULL,
  gmb_rating       numeric(2,1) DEFAULT 0,
  gmb_reviews      integer DEFAULT 0,
  gmb_unanswered   integer DEFAULT 0,
  gmb_latest_pub   text DEFAULT '',
  gmb_pub_views    integer DEFAULT 0,
  creado_en        timestamptz DEFAULT now()
);

-- DOCUMENTOS
CREATE TABLE IF NOT EXISTS documentos (
  id          bigserial PRIMARY KEY,
  cliente_id  uuid REFERENCES clientes(id) ON DELETE CASCADE,
  sede_id     bigint REFERENCES sedes(id) ON DELETE SET NULL,
  nombre      text NOT NULL,
  url         text NOT NULL DEFAULT '',
  tipo        text DEFAULT 'Documento',
  subido_por  text DEFAULT 'Agencia',
  creado_en   timestamptz DEFAULT now()
);

-- LEADS (Módulo Comercial)
CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  nombre          text NOT NULL,
  empresa         text DEFAULT '',
  email           text DEFAULT '',
  telefono        text DEFAULT '',
  fuente          text DEFAULT 'Orgánico',
  servicio        text DEFAULT '',
  estado          text DEFAULT 'Nuevo'
    CHECK (estado IN ('Nuevo','Cualificado','Propuesta','Negociación','Cerrado-Ganado','Cerrado-Perdido')),
  valor_estimado  numeric DEFAULT 0,
  cac             numeric DEFAULT 0,
  notas           text DEFAULT '',
  fecha_creacion  timestamptz DEFAULT now(),
  fecha_cierre    timestamptz
);

-- FACTURAS (Módulo Financiero)
CREATE TABLE IF NOT EXISTS facturas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid REFERENCES clientes(id) ON DELETE CASCADE,
  concepto          text NOT NULL,
  importe           numeric NOT NULL DEFAULT 0,
  estado            text DEFAULT 'Pendiente'
    CHECK (estado IN ('Pagada','Pendiente','Vencida')),
  fecha_emision     date DEFAULT current_date,
  fecha_vencimiento date,
  fecha_pago        date
);

-- PROYECTOS_RENTABILIDAD (Módulo Financiero - análisis de márgenes)
CREATE TABLE IF NOT EXISTS proyectos_rentabilidad (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  cliente_id    uuid REFERENCES clientes(id) ON DELETE SET NULL,
  presupuesto   numeric DEFAULT 0,
  coste         numeric DEFAULT 0,
  fecha_inicio  date DEFAULT current_date,
  fecha_fin     date
);

-- PROYECTOS (Módulo Operaciones — también visible en perfil cliente)
CREATE TABLE IF NOT EXISTS proyectos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  text NOT NULL,
  cliente_id              uuid REFERENCES clientes(id) ON DELETE SET NULL,
  sede_id                 bigint REFERENCES sedes(id) ON DELETE SET NULL,
  estado                  text DEFAULT 'En curso'
    CHECK (estado IN ('En curso','En riesgo','Retrasado','Bloqueado','Completado')),
  fase                    text DEFAULT '',
  fecha_inicio            date DEFAULT current_date,
  fecha_entrega_estimada  date,
  fecha_entrega_real      date
);

-- MIEMBROS_EQUIPO (Módulo Operaciones)
CREATE TABLE IF NOT EXISTS miembros_equipo (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                   text NOT NULL,
  rol                      text DEFAULT '',
  horas_disponibles_semana integer DEFAULT 40,
  horas_asignadas_semana   integer DEFAULT 0
);

-- TICKETS (Módulo Soporte — también visible en portal cliente)
CREATE TABLE IF NOT EXISTS tickets (
  id                      bigserial PRIMARY KEY,
  asunto                  text NOT NULL,
  descripcion             text DEFAULT '',
  cliente_id              uuid REFERENCES clientes(id) ON DELETE SET NULL,
  prioridad               text DEFAULT 'Media'
    CHECK (prioridad IN ('Alta','Media','Baja')),
  estado                  text DEFAULT 'Abierto'
    CHECK (estado IN ('Abierto','En proceso','Cerrado')),
  fecha_creacion          timestamptz DEFAULT now(),
  fecha_primera_respuesta timestamptz,
  fecha_cierre            timestamptz,
  satisfaccion            integer CHECK (satisfaccion BETWEEN 1 AND 5)
);

-- SERVIDORES (Módulo Soporte)
CREATE TABLE IF NOT EXISTS servidores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL,
  estado            text DEFAULT 'Online'
    CHECK (estado IN ('Online','Mantenimiento','Offline')),
  uptime_porcentaje numeric(5,2) DEFAULT 100
);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE sedes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos_rentabilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros_equipo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE servidores           ENABLE ROW LEVEL SECURITY;

-- Funciones helper (reusan las existentes o las crean si no existen)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_client_id()
RETURNS uuid AS $$
  SELECT cliente_id FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- sedes
DROP POLICY IF EXISTS "sedes_admin_all"    ON sedes;
DROP POLICY IF EXISTS "sedes_client_read"  ON sedes;
CREATE POLICY "sedes_admin_all"   ON sedes FOR ALL    USING (get_my_role() = 'ADMIN');
CREATE POLICY "sedes_client_read" ON sedes FOR SELECT USING (get_my_role() = 'CLIENT' AND cliente_id = get_my_client_id());

-- documentos
DROP POLICY IF EXISTS "docs_admin_all"     ON documentos;
DROP POLICY IF EXISTS "docs_client_read"   ON documentos;
DROP POLICY IF EXISTS "docs_client_insert" ON documentos;
CREATE POLICY "docs_admin_all"     ON documentos FOR ALL    USING (get_my_role() = 'ADMIN');
CREATE POLICY "docs_client_read"   ON documentos FOR SELECT USING (get_my_role() = 'CLIENT' AND cliente_id = get_my_client_id());
CREATE POLICY "docs_client_insert" ON documentos FOR INSERT WITH CHECK (get_my_role() = 'CLIENT' AND cliente_id = get_my_client_id());

-- leads (solo admin)
DROP POLICY IF EXISTS "leads_admin_all" ON leads;
CREATE POLICY "leads_admin_all" ON leads FOR ALL USING (get_my_role() = 'ADMIN');

-- facturas
DROP POLICY IF EXISTS "facturas_admin_all"   ON facturas;
DROP POLICY IF EXISTS "facturas_client_read" ON facturas;
CREATE POLICY "facturas_admin_all"   ON facturas FOR ALL    USING (get_my_role() = 'ADMIN');
CREATE POLICY "facturas_client_read" ON facturas FOR SELECT USING (get_my_role() = 'CLIENT' AND cliente_id = get_my_client_id());

-- proyectos_rentabilidad (solo admin)
DROP POLICY IF EXISTS "proy_rent_admin_all" ON proyectos_rentabilidad;
CREATE POLICY "proy_rent_admin_all" ON proyectos_rentabilidad FOR ALL USING (get_my_role() = 'ADMIN');

-- proyectos
DROP POLICY IF EXISTS "proyectos_admin_all"   ON proyectos;
DROP POLICY IF EXISTS "proyectos_client_read" ON proyectos;
CREATE POLICY "proyectos_admin_all"   ON proyectos FOR ALL    USING (get_my_role() = 'ADMIN');
CREATE POLICY "proyectos_client_read" ON proyectos FOR SELECT USING (get_my_role() = 'CLIENT' AND cliente_id = get_my_client_id());

-- miembros_equipo (solo admin)
DROP POLICY IF EXISTS "equipo_admin_all" ON miembros_equipo;
CREATE POLICY "equipo_admin_all" ON miembros_equipo FOR ALL USING (get_my_role() = 'ADMIN');

-- tickets
DROP POLICY IF EXISTS "tickets_admin_all"   ON tickets;
DROP POLICY IF EXISTS "tickets_client_read" ON tickets;
CREATE POLICY "tickets_admin_all"   ON tickets FOR ALL    USING (get_my_role() = 'ADMIN');
CREATE POLICY "tickets_client_read" ON tickets FOR SELECT USING (get_my_role() = 'CLIENT' AND cliente_id = get_my_client_id());

-- servidores (todos leen, solo admin escribe)
DROP POLICY IF EXISTS "servidores_admin_all"  ON servidores;
DROP POLICY IF EXISTS "servidores_todos_leen" ON servidores;
CREATE POLICY "servidores_admin_all"  ON servidores FOR ALL    USING (get_my_role() = 'ADMIN');
CREATE POLICY "servidores_todos_leen" ON servidores FOR SELECT USING (true);

-- ============================================================
-- 5. DATOS DEMO (se insertan via seed.ts desde la app)
-- Servidores y equipo son independientes de clientes,
-- se pueden insertar directamente aquí:
-- ============================================================

INSERT INTO servidores (nombre, estado, uptime_porcentaje) VALUES
  ('Web Principal (tanesolutions.com)', 'Online',        99.9),
  ('Panel Clientes (app.tane.so)',       'Online',        99.5),
  ('Servidor Correo',                    'Mantenimiento', 98.2),
  ('Base de Datos Primaria',             'Online',       100.0)
ON CONFLICT DO NOTHING;

INSERT INTO miembros_equipo (nombre, rol, horas_disponibles_semana, horas_asignadas_semana) VALUES
  ('Ana',    'Diseño',    40, 38),
  ('Carlos', 'Frontend',  40, 24),
  ('Elena',  'Backend',   40, 16),
  ('David',  'PM',        40, 32)
ON CONFLICT DO NOTHING;
