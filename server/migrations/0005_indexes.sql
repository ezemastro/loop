-- migrate:no-transaction
--
-- Índices. Corre fuera de transacción porque usa CREATE INDEX CONCURRENTLY, que no puede vivir
-- dentro de una. Todas las sentencias son IF NOT EXISTS, así que si el runner se corta a mitad de
-- camino se puede volver a ejecutar sin problema.
--
-- La base tenía **2 índices en total** (los de google_id). Además de los de comunidad, esta
-- migración agrega los que faltaban en los caminos calientes: cada búsqueda ahora arranca
-- filtrando por `community_id`, así que el índice compuesto que empieza por esa columna es el que
-- sostiene el feed, el buscador, el chat y las notificaciones.

-- Los básicos que faltaban en user_schools (el único además deduplica de ahora en más)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_schools_user_school
    ON "user_schools"("user_id", "school_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_schools_school
    ON "user_schools"("school_id");

-- Scoping por comunidad
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_community    ON "users"("community_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schools_community  ON "schools"("community_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_community    ON "media"("community_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admins_community   ON "admins"("community_id");

-- Feed y buscador de publicaciones (espeja queries.searchListings / queries.listings)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_community_published_created
    ON "listings"("community_id", "created_at" DESC)
    WHERE disabled = false AND listing_status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_community_seller
    ON "listings"("community_id", "seller_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_community_buyer
    ON "listings"("community_id", "buyer_id") WHERE buyer_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_community_category
    ON "listings"("community_id", "category_id");

-- Chat (queries.messagesBySenderAndRecipient / chatsByUserId / unreadChatsCountByUserId)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_community_pair_created
    ON "messages"("community_id", "sender_id", "recipient_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_community_recipient_created
    ON "messages"("community_id", "recipient_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_community_recipient_unread
    ON "messages"("community_id", "recipient_id") WHERE is_read = false;

-- Notificaciones
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_community_user_created
    ON "notifications"("community_id", "user_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_community_user_unread
    ON "notifications"("community_id", "user_id") WHERE is_read = false;

-- Resto de tablas por usuario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_missions_community_user
    ON "user_missions"("community_id", "user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_tx_community_user
    ON "wallet_transactions"("community_id", "user_id", "created_at" DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_wishes_community_user
    ON "users_wishes"("community_id", "user_id");

-- Hijos de listings (se recorren siempre por listing_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_media_listing
    ON "listing_media"("listing_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listing_trades_listing
    ON "listing_trades"("listing_id");
