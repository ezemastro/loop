-- Tokens de verificación de email: hash + expiración (auditoría 2026-09, SEC-10).
--
-- `0008_email_verification.sql:10` guardó el token en texto plano y sin expiración: cualquiera con
-- acceso de lectura a la base (un backup, un log, una réplica) podía verificar cualquier cuenta
-- pendiente para siempre. Esta migración lo reemplaza por el digest SHA-256 del token, con una
-- expiración de 24 horas.
--
-- Transición de los tokens ya emitidos: se invalidan, NO se migran. Tres razones:
-- 1. Es técnicamente imposible in-place: `pgcrypto` no está instalada (`rg "pgcrypto\|CREATE
--    EXTENSION" server/` no encuentra nada), así que `digest()` no existe en SQL. Y agregar la
--    extensión solo para hashear valores que YA estaban en texto plano —ya expuestos a cualquiera
--    con acceso a un backup— no compra nada.
-- 2. El radio de impacto es prácticamente cero: `REQUIRE_EMAIL_VERIFICATION` está apagado por
--    defecto (`models/auth.ts:166-169` / `config.ts`), y `0008:12` ya marcó verificado a todo
--    usuario preexistente. La población con token pendiente es, como mucho, quien se registró
--    después de `0008` en un despliegue que activó la verificación.
-- 3. La recuperación ya existe y es un clic: `AuthModel.resendVerificationEmail`
--    (`models/auth.ts:325-352`) emite un token nuevo y ya rota en cada llamada.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- Los tokens vigentes se invalidan, no se migran (ver justificación arriba).
UPDATE users
   SET email_verification_token = NULL
 WHERE email_verification_token IS NOT NULL;

DROP INDEX IF EXISTS idx_users_email_verification_token;
ALTER TABLE users DROP COLUMN IF EXISTS email_verification_token;

-- Único y no solo el índice parcial no-único de 0008: ahora la búsqueda es por hash exacto, y una
-- colisión significaría que dos cuentas comparten el mismo enlace de verificación.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_hash
  ON users (email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- Parcialmente reversible: los hashes no se pueden invertir, así que todo usuario con verificación
-- pendiente va a tener que pedir un enlace nuevo. Esta migración y el código de aplicación que la
-- acompaña deben revertirse JUNTOS: la API no puede leer una columna que ya no existe, ni encontrar
-- un hash en una columna que volvió a ser texto plano.
--
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
-- CREATE INDEX IF NOT EXISTS idx_users_email_verification_token
--   ON users (email_verification_token)
--   WHERE email_verification_token IS NOT NULL;
-- DROP INDEX IF EXISTS idx_users_email_verification_hash;
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS email_verification_token_hash,
--   DROP COLUMN IF EXISTS email_verification_expires_at;
