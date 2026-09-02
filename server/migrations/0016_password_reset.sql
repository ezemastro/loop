-- Reseteo de password por email: token hasheado + expiración (auditoría 2026-09, SEC-11).
--
-- Hoy el único reseteo es `POST /admin/users/:userId/reset-password`, que exige un admin y manda
-- la password nueva en el cuerpo. Un usuario que se olvida su contraseña no tiene ningún camino de
-- autoservicio. Este flujo agrega uno, mirando el mismo patrón que `0012_verification_token_hash`
-- adoptó para el token de verificación de email — digest SHA-256, nunca el token en texto plano —
-- y sumándole desde el día uno lo que a ese otro flujo le faltaba: expiración.
--
-- `password_reset_token_hash` guarda `sha256(token)`, calculado en la aplicación con
-- `crypto.createHash("sha256")` (mismo mecanismo que `models/auth.ts` usa para el token de
-- verificación) — nunca el valor que se manda por mail. `password_reset_expires_at` vence 1 hora
-- después de emitido; se chequea en la misma sentencia `UPDATE ... WHERE ... RETURNING` que
-- consume el token, así que un token vencido se rechaza igual que uno inexistente.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

-- El lookup es por hash exacto: único, igual que `idx_users_email_verification_hash` en 0012.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_reset_hash
  ON users (password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- Aditiva: cualquier solicitud de reseteo pendiente queda huérfana (el link deja de funcionar),
-- pero eso es exactamente lo mismo que "el link venció" desde el punto de vista del usuario —
-- puede pedir uno nuevo apenas el código de aplicación que lo consume vuelva a existir.
--
-- DROP INDEX IF EXISTS idx_users_password_reset_hash;
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS password_reset_token_hash,
--   DROP COLUMN IF EXISTS password_reset_expires_at;
