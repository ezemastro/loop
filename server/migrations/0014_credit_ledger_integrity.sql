-- Integridad del sistema de créditos: ledger completo, updates guardados, unicidad de misiones
-- (auditoría 2026-09, ECO-01/ECO-02/ECO-10/ECO-11 — mitad de base de datos).
--
-- Hoy ningún movimiento de crédito dispara un `INSERT` en `wallet_transactions` salvo el ajuste
-- manual de un admin (`models/admin.ts:353`), y ese único INSERT ni siquiera completa
-- `balance_after` (`queries.ts:855-859`). `listing_trades` nunca se escribe: `queries.storeTrade`
-- tiene cero call sites. La reescritura de la aplicación (bloque `credit-economy-integrity`) hace
-- que **todo** movimiento pase por un choque único, `applyCreditMovements`, que necesita:
--
--   1. Dos deltas firmados por movimiento (`balance_delta`, `locked_delta`) — el esquema actual solo
--      tiene `amount`/`positive`, que alcanza para expresar un cambio de saldo pero no puede
--      representar el bucket de crédito bloqueado, que es donde vive la plata de cada loop en curso.
--   2. `user_id` nullable — para que borrar una cuenta conserve su historial en vez de destruirlo
--      (hoy `deleteWalletTransactionsByUserId` lo borra sin más).
--   3. Un índice único sobre `user_missions(user_id, mission_template_id)` — sin él, el fan-out
--      set-based de `assignMissionToAllUsers` (`ON CONFLICT DO NOTHING`) no tiene sobre qué conflicto
--      apoyarse, y dos admins simultáneos hoy pueden duplicar la asignación.
--   4. Un índice único sobre `mission_templates.key` — la unicidad hoy solo la vigila la aplicación
--      (`models/admin.ts:671-674`), una carrera TOCTOU real entre dos altas simultáneas.
--
-- Alternativa descartada: una tabla `credit_movements` nueva en paralelo a `wallet_transactions`.
-- Se descarta porque `wallet_transactions` ya tiene el enum correcto (`transaction_type`) y la
-- columna `balance_after` sin usar — crear una tabla nueva obligaría a reconciliar dos fuentes de
-- verdad en lugar de completar la que ya existe.
--
-- Orden de aplicación: este archivo asume que `0010_credit_balance_checks.sql` ya corrió — las filas
-- de apertura del ledger (paso 5) toman `credits_balance`/`credits_locked` tal como están, y esa
-- migración es la que garantiza que ya son `>= 0`. El runner aplica por orden lexicográfico de
-- nombre de archivo, así que `0014` siempre corre después de `0010`-`0013`.
--
-- Sin `-- migrate:no-transaction`: nada acá necesita `CONCURRENTLY`, y que las filas de apertura del
-- ledger (paso 5) queden en la misma transacción que las columnas nuevas importa más que la duración
-- del lock sobre estas tablas.

-- ── 1. Columnas nuevas en wallet_transactions ─────────────────────────────────────────────────
-- `balance_after` (BIGINT NULL) y el enum `transaction_type` YA EXISTEN
-- (`server/database_creation.sql:97,103`) y no se tocan.
ALTER TABLE "wallet_transactions"
    ADD COLUMN IF NOT EXISTS "balance_delta" BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "locked_delta"  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "locked_after"  BIGINT,
    ADD COLUMN IF NOT EXISTS "reason"        TEXT;

-- ── 2. Back-fill de balance_delta para las filas existentes ──────────────────────────────────
-- Hasta acá la única fuente son los ajustes de admin (`positive`/`amount`); sin este paso su
-- historia quedaría en cero y arruinaría cualquier reconciliación futura sobre esas filas.
UPDATE "wallet_transactions"
   SET "balance_delta" = CASE WHEN "positive" THEN "amount" ELSE -"amount" END
 WHERE "balance_delta" = 0 AND "amount" <> 0;

-- ── 3. CHECK sobre reason ─────────────────────────────────────────────────────────────────────
-- NULL se permite a propósito: cubre las filas legadas (los ajustes de admin de antes de este
-- cambio) que nunca tuvieron esta columna.
ALTER TABLE "wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_reason_check" CHECK (
        "reason" IS NULL OR "reason" IN (
            'genesis_opening_balance',
            'offer_lock', 'offer_unlock_withdrawn', 'offer_unlock_rejected',
            'accept_seller_lock', 'accept_buyer_adjust',
            'receive_buyer_settle', 'receive_seller_credit',
            'cancel_buyer_refund', 'cancel_seller_unlock',
            'deletion_release',
            'mission_reward',
            'donation_sent', 'donation_received',
            'admin_grant', 'admin_debit'
        )
    );

-- ── 4. user_id nullable + ON DELETE SET NULL ──────────────────────────────────────────────────
-- Sigue el patrón de columna explícita de `0011_message_listing_on_delete.sql`: nombrar solo
-- `user_id` en el `ON DELETE SET NULL` de la FK compuesta es obligatorio (PostgreSQL 15+, forma de
-- lista de columnas), no estilístico. Una FK compuesta sin lista de columnas pondría en NULL
-- también `community_id` -- que sigue siendo NOT NULL y es el discriminador de RLS -- y el borrado
-- fallaría por violar esa constraint. Nombrando solo `user_id` se anonimiza la fila sin tocar su
-- comunidad, que es justo lo que necesita la reconciliación por comunidad después de un borrado.
ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "wallet_transactions_user_community_fk";
ALTER TABLE "wallet_transactions" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_user_community_fk"
    FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id")
    ON DELETE SET NULL ("user_id");

-- ── 5. Filas de apertura (genesis) ────────────────────────────────────────────────────────────
-- El invariante `credits_balance == Σ balance_delta` (y su par para `credits_locked`) solo puede
-- valer si el ledger arranca de un punto conocido. Sin esta fila el invariante es falso para todo
-- usuario preexistente desde el primer día, y `reconcile-credits` no reportaría nada útil.
-- Se inserta una fila por usuario, exista o no saldo: así ORD 8 ("historial completo") también
-- vale para una cuenta que nunca tuvo créditos.
INSERT INTO "wallet_transactions"
    (user_id, community_id, type, positive, amount,
     balance_delta, locked_delta, balance_after, locked_after, reason, created_at)
SELECT id, community_id, 'admin', TRUE, credits_balance + credits_locked,
       credits_balance, credits_locked, credits_balance, credits_locked,
       'genesis_opening_balance', NOW()
  FROM "users";

-- ── 6. Unicidad de user_missions ──────────────────────────────────────────────────────────────
-- Sin created_at en esta tabla (nunca existió), el desempate usa `ctid` -- mismo patrón que la
-- deduplicación de `user_schools` en `0004_not_null_and_fks.sql:13-20`.
DELETE FROM "user_missions" a
USING "user_missions" b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.mission_template_id = b.mission_template_id;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_missions_user_template"
    ON "user_missions"("user_id", "mission_template_id");

-- ── 7. Unicidad de mission_templates.key ──────────────────────────────────────────────────────
-- Acá sí hay `created_at`: se conserva la plantilla más vieja por clave.
DELETE FROM "mission_templates" a
USING "mission_templates" b
WHERE a.key = b.key
  AND (a.created_at, a.id) > (b.created_at, b.id);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_mission_templates_key"
    ON "mission_templates"("key");

-- ── 8. status_changed_at en listings ──────────────────────────────────────────────────────────
-- `listings` no tiene ningún timestamp de estado hoy (`database_creation.sql:83-84`), y un futuro
-- job de expiración de loops lo va a necesitar. Nada lo lee todavía en este cambio -- no existe
-- ningún scheduler en el repo (`rg "setInterval|cron"` sobre `server/api/src` da cero) --, pero
-- agregar la columna ahora evita otra migración solo para eso.
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(0);
UPDATE "listings" SET "status_changed_at" = COALESCE("updated_at", "created_at")
 WHERE "status_changed_at" IS NULL;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE "listings" DROP COLUMN IF EXISTS "status_changed_at";
-- DROP INDEX IF EXISTS "uq_mission_templates_key";
-- DROP INDEX IF EXISTS "uq_user_missions_user_template";
-- -- Las filas deduplicadas en los pasos 6 y 7 NO se restauran.
-- ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "wallet_transactions_user_community_fk";
-- ALTER TABLE "wallet_transactions"
--     ADD CONSTRAINT "wallet_transactions_user_community_fk"
--     FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id");
-- -- `ALTER COLUMN user_id SET NOT NULL` NO es seguro revertirlo: las filas anonimizadas por un
-- -- borrado real ya tienen user_id NULL y romperían el rollback.
-- DELETE FROM "wallet_transactions" WHERE "reason" = 'genesis_opening_balance';
-- ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "wallet_transactions_reason_check";
-- ALTER TABLE "wallet_transactions"
--     DROP COLUMN IF EXISTS "balance_delta",
--     DROP COLUMN IF EXISTS "locked_delta",
--     DROP COLUMN IF EXISTS "locked_after",
--     DROP COLUMN IF EXISTS "reason";
