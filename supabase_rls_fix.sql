-- ═══════════════════════════════════════════════════════════════════════════
-- RLS FIX — Habilitar Row Level Security en las tablas que lo tenían ausente
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── clientes ─────────────────────────────────────────────────────────────────
-- Admins gestionan todo; clientes solo leen su propio registro.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_admin_all"   ON clientes;
DROP POLICY IF EXISTS "clientes_client_read" ON clientes;

CREATE POLICY "clientes_admin_all" ON clientes
  FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "clientes_client_read" ON clientes
  FOR SELECT USING (get_my_role() = 'CLIENT' AND id = get_my_client_id());


-- ── perfiles ─────────────────────────────────────────────────────────────────
-- Tabla de roles: cada usuario lee/edita su propio perfil.
-- Las funciones get_my_role() y get_my_client_id() son SECURITY DEFINER,
-- así que leen perfiles sin pasar por RLS (sin riesgo de recursión).
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfiles_own_select" ON perfiles;
DROP POLICY IF EXISTS "perfiles_own_update" ON perfiles;
DROP POLICY IF EXISTS "perfiles_admin_all"  ON perfiles;

CREATE POLICY "perfiles_own_select" ON perfiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "perfiles_own_update" ON perfiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "perfiles_admin_all" ON perfiles
  FOR ALL USING (get_my_role() = 'ADMIN');


-- ── usuarios ─────────────────────────────────────────────────────────────────
-- Tabla de perfiles extendidos (nombre, rol, cliente_id, horas).
-- Admins gestionan todo; cada usuario lee su propio registro;
-- clientes leen los usuarios vinculados a su cliente.
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_admin_all"    ON usuarios;
DROP POLICY IF EXISTS "usuarios_own_read"     ON usuarios;
DROP POLICY IF EXISTS "usuarios_client_read"  ON usuarios;

CREATE POLICY "usuarios_admin_all" ON usuarios
  FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "usuarios_own_read" ON usuarios
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "usuarios_client_read" ON usuarios
  FOR SELECT USING (
    get_my_role() = 'CLIENT'
    AND cliente_id = get_my_client_id()
  );


-- ── links_cliente ─────────────────────────────────────────────────────────────
-- Links compartidos con el cliente. Admins gestionan todo; clientes leen los suyos.
ALTER TABLE links_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "links_admin_all"    ON links_cliente;
DROP POLICY IF EXISTS "links_client_read"  ON links_cliente;

CREATE POLICY "links_admin_all" ON links_cliente
  FOR ALL USING (get_my_role() = 'ADMIN');

CREATE POLICY "links_client_read" ON links_cliente
  FOR SELECT USING (
    get_my_role() = 'CLIENT'
    AND cliente_id = get_my_client_id()
  );
