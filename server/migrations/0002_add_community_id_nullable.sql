-- Agrega `community_id` a todas las tablas con datos de una comunidad.
--
-- Se agrega NULLABLE y sin default a propósito: en PostgreSQL 11+ eso es una operación de catálogo
-- instantánea, sin reescribir la tabla ni tomar locks largos. El relleno va en 0003 y el NOT NULL
-- en 0004.
--
-- La columna se desnormaliza incluso donde podría derivarse por join. Dos motivos:
--   1. RLS **no es transitiva**: una policy sobre `listings` no protege `listing_media`.
--   2. Que todas las tablas tengan la misma columna hace que todas las policies sean idénticas,
--      lo cual las vuelve auditables con un grep.
--
-- No la reciben `categories` ni `mission_templates`: son catálogos compartidos entre comunidades.

ALTER TABLE "schools"             ADD COLUMN "community_id" UUID;
ALTER TABLE "users"               ADD COLUMN "community_id" UUID;
ALTER TABLE "user_schools"        ADD COLUMN "community_id" UUID;
ALTER TABLE "listings"            ADD COLUMN "community_id" UUID;
ALTER TABLE "listing_media"       ADD COLUMN "community_id" UUID;
ALTER TABLE "listing_trades"      ADD COLUMN "community_id" UUID;
ALTER TABLE "messages"            ADD COLUMN "community_id" UUID;
ALTER TABLE "notifications"       ADD COLUMN "community_id" UUID;
ALTER TABLE "user_missions"       ADD COLUMN "community_id" UUID;
ALTER TABLE "wallet_transactions" ADD COLUMN "community_id" UUID;
ALTER TABLE "users_wishes"        ADD COLUMN "community_id" UUID;
ALTER TABLE "global_stats"        ADD COLUMN "community_id" UUID;

-- `media` queda nullable para siempre: los logos de comunidad y de colegio no tienen comunidad
-- dueña, y son justamente los que necesitan verse desde afuera (pantalla de registro).
ALTER TABLE "media"               ADD COLUMN "community_id" UUID;

-- En `admins` y `admin_valid_emails`, NULL significa "super administrador" (ve todas las comunidades).
ALTER TABLE "admins"              ADD COLUMN "community_id" UUID;
ALTER TABLE "admin_valid_emails"  ADD COLUMN "community_id" UUID;
