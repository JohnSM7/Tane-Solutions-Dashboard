-- ═══════════════════════════════════════════════════════════════
-- Actualización de Seguridad (RLS) para usar la tabla 'usuarios'
-- Ejecutar este script en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabla: CLIENTES (Permitir que el cliente vea solo sus datos)
DROP POLICY IF EXISTS "Clientes ven su propio perfil" ON clientes;
CREATE POLICY "Clientes ven su propio perfil" 
  ON clientes FOR SELECT 
  TO authenticated 
  USING (
    id IN (SELECT cliente_id FROM usuarios WHERE id = auth.uid())
  );

-- 2. Tabla: PROYECTOS
DROP POLICY IF EXISTS "Clientes ven sus proyectos" ON proyectos;
CREATE POLICY "Clientes ven sus proyectos" 
  ON proyectos FOR SELECT 
  TO authenticated 
  USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE id = auth.uid())
  );

-- 3. Tabla: SEDES
DROP POLICY IF EXISTS "Clientes ven sus sedes" ON sedes;
CREATE POLICY "Clientes ven sus sedes" 
  ON sedes FOR SELECT 
  TO authenticated 
  USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE id = auth.uid())
  );

-- 4. Tabla: DOCUMENTOS
DROP POLICY IF EXISTS "Clientes ven sus documentos" ON documentos;
CREATE POLICY "Clientes ven sus documentos" 
  ON documentos FOR SELECT 
  TO authenticated 
  USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE id = auth.uid())
  );

-- 5. Tabla: FACTURAS
DROP POLICY IF EXISTS "Clientes ven sus facturas" ON facturas;
CREATE POLICY "Clientes ven sus facturas" 
  ON facturas FOR SELECT 
  TO authenticated 
  USING (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE id = auth.uid())
  );

-- 6. Asegurar que los ADMIN siguen viendo todo
-- (Normalmente los admins ya tienen bypass o políticas generales, 
-- pero añadimos una por si acaso si RLS está activo y restringido)

CREATE POLICY "Admins ven todos los clientes" ON clientes FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'ADMIN'));

CREATE POLICY "Admins ven todos los proyectos" ON proyectos FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'ADMIN'));

CREATE POLICY "Admins ven todos los documentos" ON documentos FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'ADMIN'));

CREATE POLICY "Admins ven todas las facturas" ON facturas FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'ADMIN'));
