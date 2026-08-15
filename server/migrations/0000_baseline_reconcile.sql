-- Reconcilia el esquema antes de empezar con comunidades.
--
-- `database_creation.sql` venía derivando de producción (ver los TODO de sus líneas 135 y 141:
-- `admins.username` → `email`, la tabla `admin_valid_emails` faltante, y las columnas de
-- `google_oauth_migration.sql`). Esta migración es enteramente idempotente: en una base al día es
-- un no-op, y en producción cierra la brecha. A partir de acá ambos entornos parten del mismo lugar.

-- 1. admins.username → admins.email (solo si todavía se llama username)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admins' AND column_name = 'username'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admins' AND column_name = 'email'
    ) THEN
        ALTER TABLE "admins" RENAME COLUMN "username" TO "email";
    END IF;
END $$;

-- 2. Soporte de Google OAuth (contenido de google_oauth_migration.sql, aplicado de forma segura)
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
ALTER TABLE "users"  ADD COLUMN IF NOT EXISTS "google_id" TEXT;
ALTER TABLE "admins" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users"  ALTER COLUMN "password" DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_google_id_key') THEN
        ALTER TABLE "admins" ADD CONSTRAINT "admins_google_id_key" UNIQUE ("google_id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_key') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_google_id_key" UNIQUE ("google_id");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_google_id  ON "users"("google_id");
CREATE INDEX IF NOT EXISTS idx_admins_google_id ON "admins"("google_id");

-- 3. Allowlist de emails habilitados para registrarse como admin
CREATE TABLE IF NOT EXISTS "admin_valid_emails"(
    "id"    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE
);

-- 4. El admin autorizado por entorno arranca la cadena de confianza
INSERT INTO "admin_valid_emails" ("email")
SELECT lower(current_setting('app.authorized_admin_email', true))
WHERE NULLIF(current_setting('app.authorized_admin_email', true), '') IS NOT NULL
ON CONFLICT (email) DO NOTHING;
