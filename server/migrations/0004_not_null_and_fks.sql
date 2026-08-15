-- Cierra el modelo: NOT NULL sobre `community_id` y claves foráneas **compuestas**.
--
-- Las FK compuestas son la pieza más importante de todo el aislamiento. Al referenciar
-- `(user_id, community_id) → users(id, community_id)`, una fila que cruce comunidades deja de ser
-- representable en la base: no hace falta que ninguna query se acuerde de filtrar, y ni siquiera
-- hace falta que RLS esté encendida. Un mensaje entre usuarios de comunidades distintas es
-- literalmente ininsertable.
--
-- Para el NOT NULL se usa el rodeo `CHECK NOT VALID → VALIDATE → SET NOT NULL`: así el
-- `SET NOT NULL` se apoya en el CHECK ya validado y se saltea el escaneo completo de la tabla,
-- que es lo que en producción tomaría un ACCESS EXCLUSIVE largo sobre `listings` y `messages`.

-- ── 0. Deduplicar user_schools ─────────────────────────────────────────────────────────────────
-- La tabla nunca tuvo constraint de unicidad, así que `getUserSchools` ya podía devolver colegios
-- repetidos. Hay que limpiarlo antes de crear el índice único de 0005.
DELETE FROM "user_schools" a
USING "user_schools" b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.school_id = b.school_id;

-- ── 1. NOT NULL ────────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    tabla TEXT;
    chk   TEXT;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'schools', 'users', 'user_schools', 'listings', 'listing_media', 'listing_trades',
        'messages', 'notifications', 'user_missions', 'wallet_transactions', 'users_wishes',
        'global_stats'
    ] LOOP
        chk := tabla || '_community_notnull_chk';
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I CHECK (community_id IS NOT NULL) NOT VALID',
            tabla, chk);
        EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', tabla, chk);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN community_id SET NOT NULL', tabla);
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tabla, chk);
    END LOOP;
END $$;

-- ── 2. FK simple hacia communities ─────────────────────────────────────────────────────────────
-- `media`, `admins` y `admin_valid_emails` la llevan también, pero con la columna nullable.
DO $$
DECLARE
    tabla TEXT;
    fk    TEXT;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'schools', 'users', 'user_schools', 'listings', 'listing_media', 'listing_trades',
        'messages', 'notifications', 'user_missions', 'wallet_transactions', 'users_wishes',
        'global_stats', 'media', 'admins', 'admin_valid_emails'
    ] LOOP
        fk := tabla || '_community_fk';
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (community_id) REFERENCES communities(id) NOT VALID',
            tabla, fk);
        EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', tabla, fk);
    END LOOP;
END $$;

-- ── 3. Claves candidatas que hacen posibles las FK compuestas ──────────────────────────────────
-- Son redundantes respecto de la PK, pero PostgreSQL exige un UNIQUE sobre el par exacto que se
-- referencia.
ALTER TABLE "users"    ADD CONSTRAINT "users_id_community_uq"    UNIQUE ("id", "community_id");
ALTER TABLE "schools"  ADD CONSTRAINT "schools_id_community_uq"  UNIQUE ("id", "community_id");
ALTER TABLE "listings" ADD CONSTRAINT "listings_id_community_uq" UNIQUE ("id", "community_id");

-- ── 4. Reemplazo de las FK simples por compuestas ──────────────────────────────────────────────
-- Se usa DROP ... IF EXISTS porque los nombres podrían no existir en una base que derivó.
-- Nota sobre nulos: PostgreSQL usa MATCH SIMPLE por defecto, así que cuando la columna
-- referenciante es NULL (buyer_id, attached_listing_id) la constraint no se evalúa — que es
-- exactamente lo que queremos.

ALTER TABLE "user_schools" DROP CONSTRAINT IF EXISTS "user_schools_user_id_foreign";
ALTER TABLE "user_schools" DROP CONSTRAINT IF EXISTS "user_schools_school_id_foreign";
ALTER TABLE "user_schools"
    ADD CONSTRAINT "user_schools_user_community_fk"
    FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id");
ALTER TABLE "user_schools"
    ADD CONSTRAINT "user_schools_school_community_fk"
    FOREIGN KEY ("school_id", "community_id") REFERENCES "schools"("id", "community_id");

ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "listings_seller_id_foreign";
ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "listings_buyer_id_foreign";
ALTER TABLE "listings"
    ADD CONSTRAINT "listings_seller_community_fk"
    FOREIGN KEY ("seller_id", "community_id") REFERENCES "users"("id", "community_id");
ALTER TABLE "listings"
    ADD CONSTRAINT "listings_buyer_community_fk"
    FOREIGN KEY ("buyer_id", "community_id") REFERENCES "users"("id", "community_id");

-- Esta es la que garantiza que comprador y vendedor comparten comunidad, algo que una FK simple
-- nunca pudo expresar.
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_sender_id_foreign";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_recipient_id_foreign";
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_attached_listing_id_foreign";
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sender_community_fk"
    FOREIGN KEY ("sender_id", "community_id") REFERENCES "users"("id", "community_id");
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_recipient_community_fk"
    FOREIGN KEY ("recipient_id", "community_id") REFERENCES "users"("id", "community_id");
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_attached_listing_community_fk"
    FOREIGN KEY ("attached_listing_id", "community_id") REFERENCES "listings"("id", "community_id");

ALTER TABLE "listing_media" DROP CONSTRAINT IF EXISTS "listing_media_listing_id_foreign";
ALTER TABLE "listing_media"
    ADD CONSTRAINT "listing_media_listing_community_fk"
    FOREIGN KEY ("listing_id", "community_id") REFERENCES "listings"("id", "community_id")
    ON DELETE CASCADE;

ALTER TABLE "listing_trades" DROP CONSTRAINT IF EXISTS "listing_trades_listing_id_foreign";
ALTER TABLE "listing_trades" DROP CONSTRAINT IF EXISTS "listing_trades_trade_listing_id_foreign";
ALTER TABLE "listing_trades"
    ADD CONSTRAINT "listing_trades_listing_community_fk"
    FOREIGN KEY ("listing_id", "community_id") REFERENCES "listings"("id", "community_id");
ALTER TABLE "listing_trades"
    ADD CONSTRAINT "listing_trades_trade_community_fk"
    FOREIGN KEY ("trade_listing_id", "community_id") REFERENCES "listings"("id", "community_id");

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_foreign";
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_community_fk"
    FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id");

ALTER TABLE "user_missions" DROP CONSTRAINT IF EXISTS "user_missions_user_id_foreign";
ALTER TABLE "user_missions"
    ADD CONSTRAINT "user_missions_user_community_fk"
    FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id");

ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "wallet_transactions_user_id_foreign";
ALTER TABLE "wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_user_community_fk"
    FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id");

ALTER TABLE "users_wishes" DROP CONSTRAINT IF EXISTS "users_wishes_user_id_foreign";
ALTER TABLE "users_wishes"
    ADD CONSTRAINT "users_wishes_user_community_fk"
    FOREIGN KEY ("user_id", "community_id") REFERENCES "users"("id", "community_id");

-- ── 5. Stats por comunidad ─────────────────────────────────────────────────────────────────────
-- `global_stats` deja de ser 3 filas globales y pasa a ser 3 por comunidad.
CREATE UNIQUE INDEX idx_global_stats_community_name ON "global_stats"("community_id", "stat_name");
