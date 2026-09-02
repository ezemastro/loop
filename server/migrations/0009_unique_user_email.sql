-- Unicidad de email a nivel de base de datos (auditoría 2026-09, SEC-05).
--
-- Hasta ahora la única protección era un `SELECT EXISTS(...)` hecho en una conexión separada
-- *antes* del INSERT (`models/auth.ts:152-162`, `queries.userExists`): dos registros para el mismo
-- correo llegando en simultáneo pasan ambos ese chequeo y el segundo INSERT no tiene nada que lo
-- rechace. Esta migración mueve la garantía a donde no se puede saltear: un índice único sobre
-- `lower(email)`, exactamente la expresión que ya usan todos los lookups existentes
-- (`queries.ts:53-57,84-88,105`), así que el índice es usable por ellos sin tocar ninguna query de
-- lectura.
--
-- `lower(email)` y no `citext`: cambiar el tipo de columna exigiría una extensión y un rewrite de
-- la columna; una expresión funcional alcanza porque el código entero ya compara así.

-- ── 1. Chequeo previo: la migración nunca deduplica sola ──────────────────────────────────────
-- Un duplicado real solo puede venir de una carrera genuina (el pre-chequeo de la app ya evita el
-- caso normal), así que en producción el conteo esperado es cero y este bloque es un no-op barato.
-- Si no lo es, una fila duplicada puede tener publicaciones, mensajes, saldo y colegios propios
-- distintos: no existe una regla automática segura para decidir cuál gana. Por eso se aborta y se
-- nombra a los responsables, en vez de borrar, fusionar o reescribir cualquier fila.
-- `server/scripts/audit-duplicate-emails.sql` corre este mismo chequeo de forma read-only para que
-- un operador lo audite contra producción *antes* de que esta migración se aplique ahí.
DO $$
DECLARE dupes TEXT;
BEGIN
    SELECT string_agg(DISTINCT lower(email), ', ')
      INTO dupes
      FROM users
     GROUP BY lower(email)
    HAVING count(*) > 1;

    IF dupes IS NOT NULL THEN
        RAISE EXCEPTION
          'No se puede crear el índice único: hay emails duplicados en users (%). '
          'Resolvelos con server/scripts/audit-duplicate-emails.sql antes de migrar.', dupes;
    END IF;
END $$;

-- ── 2. El índice único ──────────────────────────────────────────────────────────────────────────
-- Transaccional, deliberadamente NO `CONCURRENTLY`, a diferencia de `0005`. Dos razones:
--
-- 1. Atomicidad: el chequeo de arriba y la construcción del índice tienen que vivir en la misma
--    transacción, o un registro que corra justo entre ambos pasos podría colar un duplicado nuevo
--    después de que el chequeo dijo "todo bien" pero antes de que el índice exista.
-- 2. `CONCURRENTLY` tiene una trampa: si el build concurrente falla, deja un índice **inválido**
--    (no uno ausente), y el próximo `IF NOT EXISTS` de este mismo archivo lo ve y lo saltea — la
--    base queda desprotegida para siempre mientras el runner reporta éxito. `users` en un
--    despliegue de una sola comunidad es chica, así que el `ACCESS EXCLUSIVE` de la versión
--    transaccional se mide en milisegundos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_uq ON users (lower(email));

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_users_email_lower_uq;
