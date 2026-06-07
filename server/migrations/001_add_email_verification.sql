-- Migración: Agregar verificación de email a la tabla users
-- Ejecutar en producción: psql -h <host> -U <user> -d <db> -f 001_add_email_verification.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT;

-- Los usuarios existentes (previos a esta migración) se marcan como verificados
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;
