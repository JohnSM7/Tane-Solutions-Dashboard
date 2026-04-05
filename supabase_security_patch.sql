-- ============================================================
-- SECURITY PATCH — Tane Solutions Dashboard
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABLA PERFILES — Activar RLS y añadir políticas
-- ============================================================
-- Sin esto, cualquier usuario autenticado puede leer/modificar
-- los perfiles de otros usuarios.

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfiles_admin_all"    ON perfiles;
DROP POLICY IF EXISTS "perfiles_self_read"    ON perfiles;
DROP POLICY IF EXISTS "perfiles_self_update"  ON perfiles;

-- Admin tiene acceso total
CREATE POLICY "perfiles_admin_all"
  ON perfiles FOR ALL
  USING (get_my_role() = 'ADMIN');

-- Cada usuario solo puede leer su propio perfil
CREATE POLICY "perfiles_self_read"
  ON perfiles FOR SELECT
  USING (auth.uid() = id);

-- Cada usuario solo puede actualizar su propio perfil
CREATE POLICY "perfiles_self_update"
  ON perfiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 2. SERVIDORES — Requerir autenticación para leer
-- ============================================================
-- La política anterior "servidores_todos_leen" permite
-- acceso anónimo (USING (true)).

DROP POLICY IF EXISTS "servidores_todos_leen" ON servidores;

CREATE POLICY "servidores_auth_read"
  ON servidores FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. FUNCIONES HELPER — Restringir a usuarios autenticados
-- ============================================================
-- get_my_role() y get_my_client_id() no deben ser invocables
-- por usuarios anónimos.

REVOKE EXECUTE ON FUNCTION get_my_role()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_my_client_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_role()      TO authenticated;
GRANT  EXECUTE ON FUNCTION get_my_client_id() TO authenticated;

-- ============================================================
-- 4. VERIFICACIÓN — Confirmar RLS activo en todas las tablas
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Todas las filas deben mostrar rls_enabled = true
