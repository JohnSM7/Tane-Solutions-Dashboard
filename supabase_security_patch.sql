-- FIX: Infinite recursion in RLS policies for "perfiles" table
-- This script creates a security-definer function to safely retrieve 
-- user roles without triggering recursive RLS checks.

-- 1. Remove conflicting policies
DROP POLICY IF EXISTS "Perfiles editables por admins" ON perfiles;
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON perfiles;
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON perfiles;

-- 2. Create the role-fetching helper
-- SECURITY DEFINER allows this function to bypass RLS checks for its internal query.
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT rol INTO user_role 
  FROM public.perfiles 
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure RLS is enabled
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- 4. Apply clean, non-recursive policies
CREATE POLICY "Lectura de perfiles segura"
ON perfiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR get_auth_user_role() = 'ADMIN'
);

CREATE POLICY "Escritura de perfiles segura"
ON perfiles FOR ALL
TO authenticated
USING (
  get_auth_user_role() = 'ADMIN'
)
WITH CHECK (
  get_auth_user_role() = 'ADMIN'
);
