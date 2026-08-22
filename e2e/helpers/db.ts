import { Pool } from "pg";
import { ENV } from "./config";

/**
 * Pool de superusuario (dueño de las tablas) para sembrar fixtures y hacer ASSERTIONS de lectura
 * contra la base. Es seguro porque la base es efímera y se crea exclusivamente para la corrida de
 * tests (docker-compose.e2e.yml). El rol dueño figura deliberadamente exento de RLS (migración
 * 0007), así que estas consultas ven TODO: eso permite verificar aislamiento real entre
 * comunidades y saldos sin que RLS esconda filas "por casualidad".
 */
export const db = new Pool({
  host: ENV.PGHOST,
  port: ENV.POSTGRES_PORT,
  user: ENV.POSTGRES_USER,
  password: ENV.POSTGRES_PASSWORD,
  database: ENV.POSTGRES_DB,
});

export type Row = Record<string, unknown>;

export const query = async <T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> => {
  const { rows } = await db.query<T>(text, params);
  return rows;
};

export const closeDb = () => db.end();

// ---------------------------------------------------------------------------
// Lecturas (assertions)
// ---------------------------------------------------------------------------

export const getCommunityBySlug = (slug: string) =>
  query<{ id: string; name: string }>(`SELECT id, name FROM communities WHERE slug = $1`, [slug]);

export const getUserByEmail = (email: string) =>
  query<{
    id: string;
    community_id: string;
    credits_balance: number;
    credits_locked: number;
  }>(`SELECT id, community_id, credits_balance, credits_locked FROM users WHERE email = $1`, [email]);

export const getUserSchools = (userId: string) =>
  query<{ school_id: string }>(`SELECT school_id FROM user_schools WHERE user_id = $1`, [userId]);

export const getListingById = (listingId: string) =>
  query<{
    id: string;
    seller_id: string;
    buyer_id: string | null;
    listing_status: string;
    price_credits: number;
    offered_credits: number | null;
    community_id: string;
    disabled: boolean;
    title: string;
  }>(
    `SELECT id, seller_id, buyer_id, listing_status, price_credits, offered_credits, community_id, disabled, title
     FROM listings WHERE id = $1`,
    [listingId],
  );

export const getListingMedia = (listingId: string) =>
  query<{ media_id: string; position: number | null }>(
    `SELECT media_id, "position" FROM listing_media WHERE listing_id = $1 ORDER BY "position" NULLS LAST`,
    [listingId],
  );

export const getListingTrades = (listingId: string) =>
  query<{ trade_listing_id: string }>(
    `SELECT trade_listing_id FROM listing_trades WHERE listing_id = $1 OR trade_listing_id = $1`,
    [listingId],
  );

export const getNotificationsForUser = (userId: string) =>
  query<{
    id: string;
    type: string;
    is_read: boolean;
    payload: { type?: string } | null;
  }>(`SELECT id, type, is_read, payload FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`, [
    userId,
  ]);

export const getWalletTransactionsForUser = (userId: string) =>
  query<{ id: string; type: string; positive: boolean; amount: number; balance_after: number }>(
    `SELECT id, type, positive, amount, balance_after FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );

export const getMessagesBetween = (userA: string, userB: string) =>
  query<{ id: string; sender_id: string; recipient_id: string; text: string; is_read: boolean }>(
    `SELECT id, sender_id, recipient_id, text, is_read FROM messages
     WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
     ORDER BY created_at ASC`,
    [userA, userB],
  );

export const getWishesForUser = (userId: string) =>
  query<{ id: string; category_id: string; comment: string | null }>(
    `SELECT id, category_id, comment FROM users_wishes WHERE user_id = $1`,
    [userId],
  );

export const getCategoryByName = (name: string) =>
  query<{ id: string; min_price_credits: number | null; max_price_credits: number | null }>(
    `SELECT id, min_price_credits, max_price_credits FROM categories WHERE name = $1`,
    [name],
  );

export const getGlobalStatsByCommunity = (communityId: string) =>
  query<{ stat_name: string; stat_value: number }>(
    `SELECT stat_name, stat_value FROM global_stats WHERE community_id = $1`,
    [communityId],
  );

// ---------------------------------------------------------------------------
// Siembra (fixtures — datos de prueba, nunca lógica de negocio)
// ---------------------------------------------------------------------------

/** Inserta media compartida/scopeada y devuelve su id. */
export const insertMedia = async (communityId: string | null, url: string): Promise<string> => {
  const [row] = await query<{ id: string }>(
    `INSERT INTO media (url, mime, media_type, community_id) VALUES ($1, 'image/png', 'image', $2) RETURNING id`,
    [url, communityId],
  );
  return row.id;
};

/** Crea una escuela con su logo y la asocia a la comunidad. */
export const seedSchool = async (communityId: string, name: string): Promise<string> => {
  const mediaId = await insertMedia(communityId, `e2e-school-${name}.png`);
  const [row] = await query<{ id: string }>(
    `INSERT INTO schools (name, media_id, community_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, mediaId, communityId],
  );
  if (!row) throw new Error(`No se pudo sembrar la escuela ${name}`);
  return row.id;
};

/** Crea una comunidad de prueba con sus dominios (para tests de aislamiento). */
export const seedCommunity = async ({
  slug,
  name,
  domains,
}: {
  slug: string;
  name: string;
  domains: string[];
}) => {
  const [community] = await query<{ id: string }>(
    `INSERT INTO communities (slug, name, theme, active) VALUES ($1, $2, '{}'::jsonb, TRUE) RETURNING id`,
    [slug, name],
  );
  if (!community) throw new Error(`No se pudo crear la comunidad ${slug}`);
  for (const domain of domains) {
    await query(`INSERT INTO community_email_domains (community_id, domain) VALUES ($1, $2)`, [
      community.id,
      domain,
    ]);
  }
  const schoolId = await seedSchool(community.id, `${name} School`);
  return { communityId: community.id, schoolId };
};

/**
 * Autoriza un email para registrarse como admin.
 *
 * La migración 0006 exige `community_admin` con `community_id` NOT NULL (CHECK
 * `admin_valid_emails_role_scope_chk`), así que por defecto se crea un SUPER admin (community_id
 * NULL), que es lo que necesitan los tests para acreditar créditos sin depender del admin de una
 * comunidad concreta.
 */
export const seedAdminEmail = async (email: string): Promise<void> => {
  await query(
    `INSERT INTO admin_valid_emails (email, role, community_id) VALUES ($1, 'super_admin', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [email],
  );
};