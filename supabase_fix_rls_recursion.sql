-- ============================================================
-- FIX: Recursión infinita en políticas RLS de perfiles
-- Ejecutar en Supabase > SQL Editor
-- ============================================================
-- Causa: get_my_role() lee de 'perfiles', cuyas políticas
-- llaman a get_my_role() → bucle infinito.
-- Solución: añadir SET row_security = off a las funciones
-- helper para que lean perfiles sin activar RLS.
-- ============================================================

-- Recrear funciones helper con row_security desactivado
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT rol FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
SET row_security = off;

CREATE OR REPLACE FUNCTION get_my_client_id()
RETURNS uuid AS $$
  SELECT cliente_id FROM perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
SET row_security = off;

-- Restaurar permisos de ejecución
REVOKE EXECUTE ON FUNCTION get_my_role()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_my_client_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_role()      TO authenticated;
GRANT  EXECUTE ON FUNCTION get_my_client_id() TO authenticated;

-- Verificación: debe poder ejecutarse sin error
SELECT get_my_role(), get_my_client_id();
