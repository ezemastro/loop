-- Listings borrables aunque estén adjuntos a un mensaje (auditoría 2026-09, ECO-09).
--
-- `0004_not_null_and_fks.sql:105-107` creó la FK compuesta `messages_attached_listing_community_fk`
-- sin ninguna acción de `ON DELETE`. Consecuencia: cualquier listing que alguna vez se haya adjuntado
-- a un mensaje queda imposible de borrar (`DELETE /listings/:id` → `queries.deleteListingById`,
-- `queries.ts:217-221` → 500 por violación de FK) para siempre, incluso después de que la
-- conversación terminó.
--
-- La corrección es aflojar la FK con `ON DELETE SET NULL`, pero con la forma de **lista de
-- columnas** (PostgreSQL 15+; el stack es `postgres:16`), NO la forma simple. Es obligatorio, no
-- estilístico: un `ON DELETE SET NULL` sin lista de columnas en una FK compuesta pondría en NULL
-- también `community_id` — que es `NOT NULL` desde `0004` y es el discriminador de RLS — así que el
-- delete fallaría por violar esa constraint y el límite de tenant quedaría en riesgo. Nombrar
-- explícitamente `attached_listing_id` pone en NULL solo la mitad opcional, que es exactamente la
-- semántica que `0004:72-74` ya documenta para `MATCH SIMPLE` en esta FK.
--
-- No hace falta limpiar datos: la constraint se afloja, así que toda fila existente sigue siendo
-- válida sin ningún cambio.
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_attached_listing_community_fk";
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_attached_listing_community_fk"
    FOREIGN KEY ("attached_listing_id", "community_id") REFERENCES "listings"("id", "community_id")
    ON DELETE SET NULL ("attached_listing_id");

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_attached_listing_community_fk";
-- ALTER TABLE "messages"
--     ADD CONSTRAINT "messages_attached_listing_community_fk"
--     FOREIGN KEY ("attached_listing_id", "community_id") REFERENCES "listings"("id", "community_id");
-- -- Los `attached_listing_id` que ya se hayan puesto en NULL por el ON DELETE no son recuperables.
