ALTER DATABASE loop_db SET timezone TO 'America/Argentina/Buenos_Aires';

CREATE TABLE "schools"(
    "id" UUID default gen_random_uuid() primary key,
    "name" TEXT NOT null unique,
    "media_id" UUID NOT NULL,
    "meta" jsonb NULL,
    "stat_kg_waste" FLOAT(53) default 0 NOT NULL,
    "stat_kg_co2" FLOAT(53) default 0 NOT NULL,
    "stat_l_h2o" FLOAT(53) default 0 NOT NULL
);
CREATE TABLE "users"(
    "id" UUID default gen_random_uuid() primary key,
    "password" TEXT not null,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT not NULL,
    "phone" TEXT,
    "profile_media_id" UUID,
    "credits_balance" BIGINT default 0 NOT NULL,
    "credits_locked" BIGINT default 0 NOT NULL,
    "created_at" TIMESTAMP(0) default NOW() NOT NULL,
    "updated_at" TIMESTAMP(0),
    "notification_token" TEXT,
    "stat_kg_waste" FLOAT(53) default 0 NOT NULL,
    "stat_kg_co2" FLOAT(53) default 0 NOT NULL,
    "stat_l_h2o" FLOAT(53) default 0 NOT NULL
);
CREATE TABLE "user_schools"(
    "id" UUID default gen_random_uuid() primary key,
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL
);
CREATE TABLE "categories"(
    "id" UUID default gen_random_uuid() primary key,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "description" TEXT,
    "min_price_credits" INTEGER,
    "max_price_credits" INTEGER,
    "created_at" TIMESTAMP(0) default NOW() NOT null,
    "icon" TEXT,
    "stat_kg_waste" FLOAT(53),
    "stat_kg_co2" FLOAT(53),
    "stat_l_h2o" FLOAT(53)
);
CREATE TABLE "media"(
    "id" UUID default gen_random_uuid() primary key,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "media_type" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(0) default NOW() NOT NULL
);
create type listing_status as enum ('published', 'offered', 'accepted', 'received');
create type product_status as enum ('new', 'like_new', 'very_good', 'good', 'fair');
CREATE TABLE "listings"(
    "id" UUID default gen_random_uuid() primary key,
    "seller_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "price_credits" INTEGER NOT NULL,
    "listing_status" listing_status NOT NULL,
    "product_status" product_status not null,
    "disabled" boolean default false,
    "buyer_id" UUID,
    "offered_credits" INTEGER,
    "created_at" TIMESTAMP(0) default NOW() not null,
    "updated_at" TIMESTAMP(0)
);
create table "listing_trades" (
	"id" UUID default gen_random_uuid() primary key,
	"listing_id" UUID not null,
	"trade_listing_id" UUID not null
);
CREATE TABLE "listing_media"(
    "id" UUID default gen_random_uuid() primary key,
    "listing_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" SMALLINT
);
create type transaction_type as enum ('loop', 'mission', 'admin', 'donation');
CREATE TABLE "wallet_transactions"(
    "id" UUID default gen_random_uuid() primary key,
    "user_id" UUID NOT NULL,
    "type" transaction_type not NULL,
    "positive" BOOLEAN not null,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NULL,
    "reference_id" UUID,
    "meta" jsonb,
    "created_at" TIMESTAMP(0) default NOW() NOT NULL
);
CREATE TABLE "mission_templates"(
    "id" UUID default gen_random_uuid() primary key,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reward_credits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(0) default NOW() NOT NULL
);
CREATE TABLE "user_missions"(
    "id" UUID default gen_random_uuid() primary key,
    "user_id" UUID NOT NULL,
    "mission_template_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(0),
    "completed" BOOLEAN not NULL,
    "progress" jsonb NOT NULL
);
create type notification_type as enum ('mission', 'loop', 'donation', 'admin');
CREATE TABLE "notifications"(
    "id" UUID default gen_random_uuid() primary key,
    "user_id" UUID NOT NULL,
    "type" notification_type NOT NULL,
    "payload" jsonb NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
    "read_at" TIMESTAMP(0),
    "created_at" TIMESTAMP(0) default NOW() NOT NULL
);
CREATE TABLE "messages"(
    "id" UUID default gen_random_uuid() primary key,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "attached_listing_id" UUID,
    "is_read" boolean DEFAULT FALSE NOT NULL,
    "created_at" TIMESTAMP(0) default NOW() NOT NULL
);
CREATE TABLE "admins"(
    "id" UUID default gen_random_uuid() primary key,
    "username" TEXT NOT NULL unique,
    "full_name" TEXT NOT NULL,
    "password" TEXT not null,
    "created_at" TIMESTAMP(0) default NOW() NOT NULL
);
CREATE TABLE "global_stats" (
    "id" UUID default gen_random_uuid() primary key,
    "stat_name" TEXT NOT NULL,
    "stat_value" FLOAT(53) NOT NULL
);
INSERT INTO "global_stats" ("stat_name", "stat_value") VALUES
    ('total_kg_waste', 0),
    ('total_kg_co2', 0),
    ('total_l_h2o', 0);
CREATE TABLE "users_wishes" (
    "id" UUID default gen_random_uuid() primary key,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "comment" TEXT,
    UNIQUE("user_id", "category_id")
);
ALTER TABLE
    users_wishes ADD CONSTRAINT "users_wishes_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    users_wishes ADD CONSTRAINT "users_wishes_category_id_foreign" FOREIGN KEY("category_id") REFERENCES "categories"("id");
ALTER TABLE
    categories ADD CONSTRAINT "categories_parent_id_foreign" FOREIGN KEY("parent_id") REFERENCES "categories"("id");
ALTER TABLE
    messages ADD CONSTRAINT "messages_recipient_id_foreign" FOREIGN KEY("recipient_id") REFERENCES "users"("id");
ALTER TABLE
    messages ADD CONSTRAINT "messages_attached_listing_id_foreign" FOREIGN KEY("attached_listing_id") REFERENCES "listings"("id");
ALTER TABLE
    wallet_transactions ADD CONSTRAINT "wallet_transactions_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    notifications ADD CONSTRAINT "notifications_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    user_missions ADD CONSTRAINT "user_missions_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    listings ADD CONSTRAINT "listings_seller_id_foreign" FOREIGN KEY("seller_id") REFERENCES "users"("id");
ALTER TABLE
    messages ADD CONSTRAINT "messages_sender_id_foreign" FOREIGN KEY("sender_id") REFERENCES "users"("id");
ALTER TABLE
    listing_media ADD CONSTRAINT "listing_media_listing_id_foreign" FOREIGN KEY("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE;
ALTER TABLE
    listing_trades ADD CONSTRAINT "listing_trades_listing_id_foreign" FOREIGN KEY("listing_id") REFERENCES "listings"("id");
ALTER TABLE
    listing_trades ADD CONSTRAINT "listing_trades_trade_listing_id_foreign" FOREIGN KEY("trade_listing_id") REFERENCES "listings"("id");
ALTER TABLE
    listing_media ADD CONSTRAINT "listing_media_media_id_foreign" FOREIGN KEY("media_id") REFERENCES "media"("id");
ALTER TABLE
    listings ADD CONSTRAINT "listings_buyer_id_foreign" FOREIGN KEY("buyer_id") REFERENCES "users"("id");
ALTER TABLE
    user_schools ADD CONSTRAINT "user_schools_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    user_schools ADD CONSTRAINT "user_schools_school_id_foreign" FOREIGN KEY("school_id") REFERENCES "schools"("id");
ALTER TABLE
    users ADD CONSTRAINT "users_profile_media_id_foreign" FOREIGN KEY("profile_media_id") REFERENCES "media"("id");
ALTER TABLE
    user_missions ADD CONSTRAINT "user_missions_mission_template_id_foreign" FOREIGN KEY("mission_template_id") REFERENCES "mission_templates"("id");
ALTER TABLE
    listings ADD CONSTRAINT "listings_category_id_foreign" FOREIGN KEY("category_id") REFERENCES "categories"("id");
ALTER TABLE
    media ADD CONSTRAINT "media_uploaded_by_foreign" FOREIGN KEY("uploaded_by") REFERENCES "users"("id");
ALTER TABLE
    schools ADD CONSTRAINT "school_media_id_foreign" FOREIGN KEY("media_id") REFERENCES "media"("id");

