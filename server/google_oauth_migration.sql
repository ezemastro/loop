-- TODO - implementarla en el database_creation.sql

-- Migración para agregar soporte de Google OAuth a la tabla admins
-- Esta migración permite que los administradores puedan iniciar sesión tanto
-- con email/password tradicional como con Google OAuth

-- 1. Agregar columna para el Google ID (identificador único de Google)
ALTER TABLE "admins" 
ADD COLUMN "google_id" TEXT UNIQUE;

-- 2. Hacer que la contraseña sea opcional (NULL) ya que los usuarios de Google 
--    pueden no tener contraseña en nuestro sistema
ALTER TABLE "admins" 
ALTER COLUMN "password" DROP NOT NULL;

-- ========================================================================
-- MIGRACIÓN PARA USUARIOS (ANDROID E IOS)
-- ========================================================================

-- 3. Agregar columna para el Google ID en la tabla users
ALTER TABLE "users" 
ADD COLUMN "google_id" TEXT UNIQUE;

-- 4. Hacer que la contraseña sea opcional en users también
ALTER TABLE "users" 
ALTER COLUMN "password" DROP NOT NULL;

-- 5. Crear índice en google_id para usuarios (búsquedas rápidas)
CREATE INDEX idx_users_google_id ON "users"("google_id");

-- 3. Opcional: Agregar columna para almacenar la foto de perfil de Google
-- ALTER TABLE "admins" 
-- ADD COLUMN "google_picture" TEXT;

-- 4. Crear un índice en google_id para búsquedas rápidas
-- CREATE INDEX idx_admins_google_id ON "admins"("google_id");

-- NOTA IMPORTANTE:
-- Si ya tienes admins en la base de datos, asegúrate de que tengan password
-- antes de ejecutar esta migración. Los admins existentes seguirán usando
-- email/password y los nuevos podrán usar Google OAuth.

-- Para verificar que la migración se aplicó correctamente:
-- SELECT column_name, is_nullable, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'admins';
