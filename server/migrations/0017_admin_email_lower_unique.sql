-- Unicidad case-insensitive de email en admins (auditoría 2026-09, gap encontrado tras SEC-05).
--
-- `0009_unique_user_email` cerró este mismo agujero en `users` con un índice único sobre
-- `lower(email)`, porque la única protección previa era un `SELECT` en una conexión separada
-- antes del INSERT: dos registros concurrentes para el mismo correo con distinta capitalización
-- pasan ambos ese chequeo. `admins` tiene el mismo patrón (`AdminModel.register`,
-- `queries.adminByEmail` ya usa `lower(email) = lower($1)` para leer) pero la tabla solo tenía
-- `email TEXT UNIQUE` — exacto por bytes, no case-insensitive — así que la misma carrera puede
-- crear dos admins para "Admin@x.com" y "admin@x.com". No hace falta tocar `models/admin.ts`:
-- `AdminModel.register` ya envuelve el INSERT en `isUniqueViolation(err)` sin nombre de constraint,
-- así que atrapa una violación de este índice nuevo exactamente igual que la del viejo
-- `admins_email_key`.

-- ── 1. Chequeo previo: la migración nunca deduplica sola ──────────────────────────────────────
-- Mismo razonamiento que 0009: una fila duplicada puede tener su propia comunidad/rol asignados,
-- no hay una regla automática segura para decidir cuál gana. Se aborta y se nombra el conflicto en
-- vez de borrar o fusionar cualquier fila.
DO $$
DECLARE dupes TEXT;
BEGIN
    SELECT string_agg(DISTINCT lower(email), ', ')
      INTO dupes
      FROM admins
     GROUP BY lower(email)
    HAVING count(*) > 1;

    IF dupes IS NOT NULL THEN
        RAISE EXCEPTION
          'No se puede crear el índice único: hay emails duplicados en admins (%). '
          'Auditalos a mano (mismo criterio que server/scripts/audit-duplicate-emails.sql, '
          'mirando a la tabla admins) antes de migrar.', dupes;
    END IF;
END $$;

-- ── 2. El índice único ──────────────────────────────────────────────────────────────────────────
-- Transaccional, no CONCURRENTLY: mismo motivo que 0009 (atomicidad con el chequeo de arriba, y
-- `admins` es chica — el ACCESS EXCLUSIVE se mide en milisegundos).
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_lower_uq ON admins (lower(email));

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_admins_email_lower_uq;
