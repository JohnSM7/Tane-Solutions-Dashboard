-- ============================================================
-- MIGRACIÓN: perfiles → usuarios
-- Ejecutar en Supabase > SQL Editor
-- ============================================================
-- Renombra la tabla perfiles a usuarios, añade horas_disponibles_semana,
-- actualiza las funciones helper de RLS, reapunta la FK de tareas,
-- y elimina miembros_equipo (vacía).
-- ============================================================

-- 1. Renombrar tabla
ALTER TABLE perfiles RENAME TO usuarios;

-- 2. Añadir columna operacional (solo relevante para rol ADMIN)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS horas_disponibles_semana integer NOT NULL DEFAULT 40;

-- 3. Actualizar funciones helper de RLS para leer de usuarios
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
SET row_security = off;

CREATE OR REPLACE FUNCTION get_my_client_id()
RETURNS uuid AS $$
  SELECT cliente_id FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
SET row_security = off;

-- Restaurar permisos
REVOKE EXECUTE ON FUNCTION get_my_role()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_my_client_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_role()      TO authenticated;
GRANT  EXECUTE ON FUNCTION get_my_client_id() TO authenticated;

-- 4. Actualizar FK en tareas: miembros_equipo → usuarios
ALTER TABLE tareas DROP CONSTRAINT IF EXISTS tareas_asignado_a_fkey;
ALTER TABLE tareas
  ADD CONSTRAINT tareas_asignado_a_fkey
  FOREIGN KEY (asignado_a) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 5. Eliminar miembros_equipo (tabla vacía, ya no se necesita)
DROP TABLE IF EXISTS miembros_equipo;

-- Verificación final
SELECT id, nombre, rol, horas_disponibles_semana FROM usuarios LIMIT 10;
