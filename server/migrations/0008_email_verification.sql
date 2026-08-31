-- Verificación de email: columnas en users para el flujo de verificación por mail.
--
-- `email_verified` es FALSE al registrarse con password; el login lo bloquea hasta
-- que el usuario haga clic en el enlace de verificación. Los usuarios de Google ya
-- vienen verificados (Google lo confirma). Los usuarios existentes previos a esta
-- migración pasaron por su comunidad/escuela y se marcan verificados, como si
-- hubieran hecho el clic.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT;

UPDATE users SET email_verified = TRUE WHERE NOT email_verified;

-- La verificación busca por token aleatorio (32 bytes): índice parcial para que ese
-- lookup no escanee la tabla entera en cada clic.
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;