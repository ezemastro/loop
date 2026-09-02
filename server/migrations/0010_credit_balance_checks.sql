-- Piso de crédito a nivel de base de datos (auditoría 2026-09, ECO-01 — mitad de base de datos).
--
-- Hoy `decreaseUserBalance` (`models/users.ts:87-93`) escribe `credits_balance` calculado en JS sin
-- ningún piso: una carrera entre dos descuentos concurrentes puede dejar un saldo negativo, y nada
-- en la base lo impide. Esta migración agrega el invariante de storage; NO reescribe cómo se
-- calcula el crédito. La reescritura a updates atómicos (relativos, con `FOR UPDATE`, con
-- `balance_after`) es responsabilidad de `credit-economy-integrity`. Hasta que esa migración se
-- aplique, una carrera que hoy corrompería el saldo en silencio va a fallar ruidosamente con
-- `23514` — que es estrictamente mejor que corromper el dato.

-- ── 1. Clampeo de filas ya corruptas, con rastro de auditoría ─────────────────────────────────
-- Un saldo negativo no tiene ninguna lectura legítima del dominio: nadie le "debe" crédito a la
-- plataforma. A diferencia del email duplicado, acá no hace falta un humano: clampear a 0 es la
-- única corrección posible, y es segura porque queda anotada en el ledger. El `amount` se escribe
-- como `0` a propósito: el verdadero monto del ajuste es inconocible-por-construcción (el valor
-- negativo ya está corrupto), e inventar uno envenenaría las sumas del ledger que
-- `credit-economy-integrity` va a reconciliar más adelante.
WITH fixed AS (
    UPDATE users
       SET credits_balance = GREATEST(credits_balance, 0),
           credits_locked  = GREATEST(credits_locked, 0)
     WHERE credits_balance < 0 OR credits_locked < 0
    RETURNING id, community_id, credits_balance, credits_locked
)
INSERT INTO wallet_transactions
    (user_id, community_id, type, positive, amount, balance_after, meta)
SELECT id, community_id, 'admin', TRUE, 0, credits_balance,
       jsonb_build_object('reason', 'migration_0010_clamp_negative_balance')
  FROM fixed;

-- ── 2. Los CHECK ───────────────────────────────────────────────────────────────────────────────
-- Dos constraints nombradas por separado, no una combinada: así una violación indica exactamente
-- qué columna falló, algo que va a importar cuando `credit-economy-integrity` empiece a disparar
-- estos checks durante su reescritura.
--
-- Sin `NOT VALID`: existe para evitar un escaneo largo bajo lock en una tabla grande, pero acá
-- dejaría que la migración reporte éxito con filas negativas preexistentes todavía en pie —
-- exactamente el "invariante que no se cumple en realidad" que este cambio busca eliminar. El
-- clampeo de arriba ya deja la tabla limpia, así que la validación es barata.
ALTER TABLE users
    ADD CONSTRAINT users_credits_balance_non_negative CHECK (credits_balance >= 0),
    ADD CONSTRAINT users_credits_locked_non_negative  CHECK (credits_locked  >= 0);

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE users
--     DROP CONSTRAINT IF EXISTS users_credits_balance_non_negative,
--     DROP CONSTRAINT IF EXISTS users_credits_locked_non_negative;
-- -- Los saldos clampeados NO se restauran: las filas de wallet_transactions insertadas arriba son
-- -- el registro de auditoría de la corrección, no un valor a deshacer.
