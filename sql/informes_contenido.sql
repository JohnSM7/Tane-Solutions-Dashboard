-- Añadir columna JSONB para almacenar el contenido completo del informe
ALTER TABLE informes ADD COLUMN IF NOT EXISTS contenido JSONB DEFAULT '{}';
