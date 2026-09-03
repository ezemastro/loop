import type { NamedQuery } from "../types/dbClient.js";
import type { SortColumn, SortDirection } from "../utils/sortOptions.js";

// Helper para crear queries nombradas
const q = <T>(key: string, text: string): NamedQuery<T> => ({
  key,
  text,
});

/**
 * Catálogo de SQL de la aplicación.
 *
 * ## Filtro de comunidad
 *
 * Las queries que tocan datos de una comunidad llevan el predicado
 *
 *     AND ($n::uuid IS NULL OR community_id = $n::uuid)
 *
 * con el parámetro de comunidad **al final** de la lista, para no renumerar los `$n` existentes.
 * Los call sites le pasan `client.communityId`, que es `null` cuando la conexión es unscoped
 * (login, panel de admin): en ese caso el predicado se desactiva solo y la query sigue sirviendo
 * para ambos casos sin duplicar el SQL.
 *
 * Este filtro es la primera de las tres capas de aislamiento. Las otras dos —las claves foráneas
 * compuestas y las policies de RLS— siguen protegiendo aunque alguien se olvide de una acá.
 *
 * ## Catálogos compartidos
 *
 * `categories` y `mission_templates` se comparten entre comunidades por decisión de producto, así
 * que sus queries no llevan filtro.
 */
export const queries = {
  deleteUserSchools: q<void>(
    "user_schools.delete",
    `DELETE FROM user_schools
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  insertUserSchools: (schoolCount: number) =>
    q<void>(
      "user_schools.insertMany",
      // $1 = user_id, $2..$n+1 = school_ids, $n+2 = community_id
      `INSERT INTO user_schools (user_id, school_id, community_id) VALUES ${Array(schoolCount)
        .fill(0)
        .map((_, i) => `($1, $${i + 2}, $${schoolCount + 2})`)
        .join(", ")}`,
    ),

  /**
   * Los dominios de correo son disjuntos entre comunidades, así que la unicidad del email es
   * global y esta comprobación no lleva filtro de comunidad.
   */
  userExists: q<{ user_exists: boolean }>(
    "user.exists",
    `SELECT EXISTS(
       SELECT 1 FROM users WHERE lower(email) = lower($1)
     ) AS user_exists`,
  ),

  /**
   * `$8` es el hash SHA-256 del token (o NULL si no se exige verificación); nunca el cleartext.
   * La expiración se calcula acá mismo, condicionada a que haya hash: sin verificación exigida no
   * hay token, y por lo tanto tampoco vencimiento.
   */
  insertUser: q<{ id: UUID }>(
    "user.insert",
    `INSERT INTO users (email, first_name, last_name, password, community_id, invitation_id, domain_exempt, email_verification_token_hash, email_verification_expires_at, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8::text IS NULL THEN NULL ELSE NOW() + INTERVAL '24 hours' END, $9)
       RETURNING id`,
  ),

  /**
   * Marca el usuario como verificado al hacer clic en el enlace del mail. Matchea por hash y exige
   * que no haya vencido: un token expirado se rechaza igual que uno inexistente.
   */
  verifyUserEmail: q<{ id: UUID }>(
    "user.verifyEmail",
    `UPDATE users
        SET email_verified = TRUE, email_verification_token_hash = NULL, email_verification_expires_at = NULL
      WHERE email_verification_token_hash = $1
        AND email_verification_expires_at > NOW()
      RETURNING id`,
  ),

  /** Rota el hash y la expiración al reenviar el mail, para invalidar enlaces viejos. */
  updateUserVerificationToken: q<void>(
    "user.updateVerificationToken",
    `UPDATE users
        SET email_verification_token_hash = $1,
            email_verification_expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = $2`,
  ),

  /**
   * Para reenviar el mail de verificación: busca si hay un usuario sin verificar. Ya no selecciona
   * el token/hash — solo necesita saber si existe uno pendiente, nunca su valor.
   */
  userEmailVerifiedAndTokenByEmail: q<Pick<DB_Users, "id" | "email_verified">>(
    "user.emailVerifiedAndTokenByEmail",
    `SELECT id, email_verified
       FROM users WHERE lower(email) = lower($1)`,
  ),

  createUserWithGoogle: q<DB_Users>(
    "user.createWithGoogle",
    `INSERT INTO users (email, first_name, last_name, password, google_id, community_id, invitation_id, domain_exempt, email_verified)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, TRUE)
       RETURNING *`,
  ),

  updateUserGoogleId: q<void>(
    "user.updateGoogleId",
    `UPDATE users SET google_id = $1, email_verified = TRUE WHERE id = $2`,
  ),

  // Camino de autenticación: todavía no sabemos la comunidad, por eso no llevan filtro.
  userByGoogleId: q<DB_Users>("user.byGoogleId", `SELECT * FROM users WHERE google_id = $1`),
  userByEmail: q<DB_Users>("user.byEmail", `SELECT * FROM users WHERE lower(email) = lower($1)`),
  userByEmailCaseInsensitive: q<DB_Users>(
    "user.byEmailCaseInsensitive",
    `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`,
  ),

  /** Usada por el middleware de token para los JWT viejos, que no traen `communityId`. */
  userCommunityById: q<{ community_id: UUID }>(
    "user.communityById",
    `SELECT community_id FROM users WHERE id = $1`,
  ),

  updateUserPassword: q<void>(
    "user.updatePassword",
    `UPDATE users SET password = $1
     WHERE id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),

  schoolById: q<DB_Schools>(
    "school.byId",
    `SELECT * FROM schools
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  userById: q<DB_Users>(
    "user.byId",
    `SELECT * FROM users
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  userSchoolsByUserId: q<DB_UserSchools>(
    "user.schoolsByUserId",
    `SELECT * FROM user_schools
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  userSchoolsByUserIds: (ids: UUID[]) =>
    q<DB_UserSchools>(
      "user.schoolsByUserIds",
      `SELECT * FROM user_schools
       WHERE user_id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),

  /**
   * La media con `community_id` nulo es un recurso compartido (logos de comunidad y de colegio) y
   * tiene que verse desde cualquier comunidad — incluso desde la pantalla de registro.
   */
  mediaById: q<DB_Media>(
    "media.byId",
    `SELECT * FROM media
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id IS NULL OR community_id = $2::uuid)`,
  ),
  mediaByIds: (ids: UUID[]) =>
    q<DB_Media>(
      "media.byIds",
      `SELECT * FROM media
       WHERE id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id IS NULL OR community_id = $2::uuid)`,
    ),

  updateUser: q<{ id: UUID }>(
    "user.update",
    `UPDATE users SET email = $1, first_name = $2, last_name = $3, phone = $4, profile_media_id = $5, password = $6
       WHERE id = $7
         AND ($8::uuid IS NULL OR community_id = $8::uuid)
       RETURNING id`,
  ),

  userMissionsByUserId: q<DB_UserMissions>(
    "missions.byUserId",
    `SELECT * FROM user_missions
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  userMissionsById: q<DB_UserMissions>(
    "missions.byId",
    `SELECT * FROM user_missions
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  // Catálogo compartido entre comunidades
  missionTemplateById: q<DB_MissionTemplates>(
    "missions.templateById",
    `SELECT * FROM mission_templates WHERE id = $1`,
  ),

  notificationsByUserId: q<DB_Notifications & DB_Pagination>(
    "notifications.byUserId",
    `SELECT
      *,
      COUNT(*) OVER() as total_records
    FROM notifications
    WHERE user_id = $1
      AND ($4::uuid IS NULL OR community_id = $4::uuid)
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
  ),

  listingById: q<DB_Listings>(
    "listings.byId",
    `SELECT * FROM listings
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  deleteListingById: q<DB_Listings>(
    "listings.deleteById",
    `DELETE FROM listings
     WHERE id = $1 AND seller_id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),

  listingMediasByListingId: q<DB_ListingMedia>(
    "listings.mediasById",
    `SELECT * FROM listing_media
     WHERE listing_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  listingMediasByListingIds: (ids: UUID[]) =>
    q<DB_ListingMedia>(
      "listingMedias.byListingIds",
      `SELECT * FROM listing_media
       WHERE listing_id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),

  // Catálogos compartidos: sin filtro de comunidad, por decisión de producto.
  categoryById: q<DB_Categories>("categories.byId", `SELECT * FROM categories WHERE id = $1`),
  categoriesByParentId: q<DB_Categories>(
    "categories.byParentId",
    `SELECT * FROM categories WHERE parent_id = $1`,
  ),
  allCategories: q<DB_Categories>("categories.all", `SELECT * FROM categories`),
  categoriesByIds: (ids: UUID[]) =>
    q<DB_Categories>("categories.byIds", `SELECT * FROM categories WHERE id = ANY($1::uuid[])`),

  markNotificationsAsRead: q(
    "notifications.markAsRead",
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  markMessagesAsRead: q(
    "messages.markAsRead",
    `UPDATE messages SET is_read = TRUE
     WHERE recipient_id = $1 AND sender_id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),

  chatsByUserId: q<
    {
      other_user_id: UUID;
      last_message_id: UUID;
      unread_count: number;
    } & DB_Pagination
  >(
    "chats.byUserId",
    `SELECT
        other_user_id,
        (SELECT m2.id
        FROM messages m2
        WHERE ((m2.sender_id = $1 AND m2.recipient_id = sub.other_user_id)
            OR (m2.recipient_id = $1 AND m2.sender_id = sub.other_user_id))
          AND ($4::uuid IS NULL OR m2.community_id = $4::uuid)
        ORDER BY m2.created_at DESC
        LIMIT 1) as last_message_id,
        unread_count,
        total_records
    FROM (
        SELECT
            CASE
                WHEN m.sender_id = $1 THEN m.recipient_id
                ELSE m.sender_id
            END as other_user_id,
            COUNT(CASE WHEN m.sender_id != $1 AND m.is_read = false THEN 1 END) as unread_count,
            COUNT(*) OVER() as total_records
        FROM messages m
        WHERE (m.sender_id = $1 OR m.recipient_id = $1)
          AND ($4::uuid IS NULL OR m.community_id = $4::uuid)
        GROUP BY
            CASE
                WHEN m.sender_id = $1 THEN m.recipient_id
                ELSE m.sender_id
            END
        ORDER BY MAX(m.created_at) DESC
        LIMIT $2 OFFSET $3
    ) sub`,
  ),

  messageById: q<DB_Messages>(
    "messages.byId",
    `SELECT * FROM messages
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  searchUsers: ({ sort, order }: { sort: SortColumn; order: SortDirection }) =>
    q<DB_Users & DB_Pagination>(
      "users.search",
      `SELECT
      u.*,
      COUNT(*) OVER() as total_records
    FROM users u
    WHERE
        ($1::text IS NULL OR $1::text = '' OR
        LOWER(u.first_name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) ESCAPE '\\' OR
        LOWER(u.last_name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) ESCAPE '\\' OR
        LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) ESCAPE '\\' OR
        LOWER(CONCAT(u.last_name, ' ', u.first_name)) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) ESCAPE '\\')
    AND
        ($2::text IS NULL OR $2::text = '' OR EXISTS (SELECT 1 FROM user_schools us WHERE us.user_id = u.id AND us.school_id::text = $2::text))
    AND
        ($3::text IS NULL OR $3::text = '' OR u.id::text != $3::text)
    AND ($6::uuid IS NULL OR u.community_id = $6::uuid)
    ORDER BY ${sort} ${order}
    LIMIT $4 OFFSET $5;`,
    ),

  searchSchools: q<DB_Schools & DB_Pagination>(
    "schools.search",
    `SELECT
        *,
        COUNT(*) OVER() as total_records
    FROM schools
    WHERE
        ($1::text IS NULL OR $1::text = '' OR
        LOWER(name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) ESCAPE '\\')
        AND ($6::uuid IS NULL OR community_id = $6::uuid)
    ORDER BY
        CASE
            WHEN $2 = 'name' AND $3 = 'asc' THEN name
            ELSE NULL
        END ASC,
        CASE
            WHEN $2 = 'name' AND $3 = 'desc' THEN name
            ELSE NULL
        END DESC
    LIMIT $4 OFFSET $5;`,
  ),

  searchListings: ({ sort, order }: { sort: SortColumn; order: SortDirection }) =>
    q<DB_Listings & DB_Pagination>(
      "listings.search",
      `SELECT
        l.*,
        COUNT(*) OVER() as total_records
    FROM listings l
    WHERE
        NOT l.disabled = true
        AND l.listing_status = 'published'

        -- comunidad (aislamiento)
        AND ($9::uuid IS NULL OR l.community_id = $9::uuid)

        -- searchTerm: busca en título o descripción
        AND ($1::text IS NULL OR $1::text = '' OR
            LOWER(l.title) LIKE LOWER(CONCAT('%', $1::text, '%')) ESCAPE '\\' OR
            LOWER(l.description) LIKE LOWER(CONCAT('%', $1::text, '%')) ESCAPE '\\')

        -- categoryId
        AND ($2::uuid IS NULL OR l.category_id = $2::uuid)

        -- productStatus
        AND ($3::product_status IS NULL OR l.product_status = $3::product_status)

        -- schoolId (filtra por escuelas del vendedor)
        AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM user_schools us WHERE us.user_id = l.seller_id AND us.school_id = $4::uuid))

        -- sellerId (vendedor)
        AND ($5::uuid IS NULL OR l.seller_id = $5::uuid)

        -- userId
        AND ($6::uuid IS NULL OR NOT l.seller_id = $6::uuid)

    ORDER BY ${sort} ${order}

    LIMIT $7 OFFSET $8;
`,
    ),

  createListing: q<{ id: UUID }>(
    "listing.create",
    `INSERT INTO listings (title, description, price_credits, category_id, seller_id, product_status, listing_status, community_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;`,
  ),

  linkMediaToListing: q<void>(
    "listing.linkMedia",
    `INSERT INTO listing_media (listing_id, media_id, community_id)
    VALUES ($1, $2, $3);`,
  ),

  getListingById: q<DB_Listings>(
    "listing.getById",
    `SELECT * FROM listings
     WHERE id = $1::UUID
       AND ($2::uuid IS NULL OR community_id = $2::uuid);`,
  ),

  updateListingById: q<void>(
    "listing.updateById",
    `UPDATE listings SET title = $1, description = $2, price_credits = $3, category_id = $4, product_status = $5
    WHERE id = $6
      AND ($7::uuid IS NULL OR community_id = $7::uuid);`,
  ),

  unlinkAllMediaFromListing: q<void>(
    "listing.unlinkAllMedia",
    `DELETE FROM listing_media
     WHERE listing_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid);`,
  ),

  /**
   * Guardado (ECO-03): solo puede pasar de `published` sin comprador a `offered`. Cero filas
   * significa que otro comprador ya lo tomó, o que dejó de estar publicado — el modelo lo trata
   * como 409, nunca como éxito silencioso.
   */
  newOffer: q<DB_Listings>(
    "listing.newOffer",
    `UPDATE listings SET listing_status = 'offered', offered_credits = $1, buyer_id = $2
    WHERE id = $3
      AND listing_status = 'published' AND buyer_id IS NULL
      AND ($4::uuid IS NULL OR community_id = $4::uuid)
    RETURNING *;`,
  ),

  /**
   * Guardado sobre `listing_status = 'offered'`. El CTE `previous` es lo que le permite al llamador
   * (`deleteOffer`/`rejectOffer`) leer `offered_credits` y `buyer_id` **tal como estaban antes** de
   * este mismo UPDATE, en el mismo statement — el `RETURNING` de un UPDATE solo puede mostrar el
   * estado posterior, y acá esos campos se pisan con NULL, así que sin el CTE no habría forma de
   * recuperar cuánto había que devolver sin una lectura previa separada y, por lo tanto, obsoleta.
   */
  deleteOffer: q<
    DB_Listings & { previous_offered_credits: DbNumber | null; previous_buyer_id: UUID | null }
  >(
    "listing.deleteOffer",
    `WITH previous AS (
       SELECT offered_credits, buyer_id FROM listings WHERE id = $1
     )
     UPDATE listings
        SET listing_status = 'published', offered_credits = NULL, buyer_id = NULL
       FROM previous
      WHERE listings.id = $1 AND listings.listing_status = 'offered'
        AND ($2::uuid IS NULL OR listings.community_id = $2::uuid)
     RETURNING listings.*,
               previous.offered_credits AS previous_offered_credits,
               previous.buyer_id AS previous_buyer_id;`,
  ),

  updateListingOfferedCreditsById: q<void>(
    "listing.updateOfferedCredits",
    `UPDATE listings SET offered_credits = $1
     WHERE id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid);`,
  ),

  /**
   * El único statement que puede mover `users.credits_balance`/`credits_locked` (ver
   * `utils/credits.ts`, `applyCreditMovements`). `$1`/`$2` son deltas con signo: una carrera de dos
   * requests concurrentes nunca ve un valor "leído y recalculado" — cada UPDATE es relativo a sí
   * mismo, y el `WHERE` rechaza cualquier movimiento que dejaría alguno de los dos buckets negativo.
   * Cero filas afectadas es el caso de "fondos insuficientes o usuario fuera de la comunidad";
   * `applyCreditMovements` lo distingue con una lectura de más solo en el camino de error.
   */
  applyCreditDelta: q<{ credits_balance: DbNumber; credits_locked: DbNumber; community_id: UUID }>(
    "user.applyCreditDelta",
    `UPDATE users
        SET credits_balance = credits_balance + $1,
            credits_locked  = credits_locked  + $2
      WHERE id = $3
        AND credits_balance + $1 >= 0
        AND credits_locked  + $2 >= 0
        AND ($4::uuid IS NULL OR community_id = $4::uuid)
      RETURNING credits_balance, credits_locked, community_id`,
  ),

  /** Ledger: una fila por movimiento, siempre en la misma transacción que `applyCreditDelta`. */
  insertCreditLedgerEntry: q<DB_WalletTransactions>(
    "wallet.insertLedgerEntry",
    `INSERT INTO wallet_transactions
        (user_id, type, positive, amount, balance_delta, locked_delta, balance_after, locked_after,
         reason, reference_id, meta, community_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
  ),

  /**
   * Suma lo donado hoy por un usuario (credit-ledger: "Donation Limits", "The daily cap is
   * enforced from the ledger"). Posible solo porque ECO-02 finalmente escribe una fila por cada
   * donación — antes no había de dónde leer esto.
   */
  donationSentTodayTotal: q<{ total: DbNumber }>(
    "wallet.donationSentTodayTotal",
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total
       FROM wallet_transactions
      WHERE user_id = $1 AND reason = 'donation_sent'
        AND created_at >= date_trunc('day', NOW())
        AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  /**
   * credit-ledger: "Reconciliation Invariant" (design D6). Cruza `users.credits_*` contra la suma
   * de deltas de su propio ledger; solo devuelve las filas que NO cuadran. Read-only por
   * construcción — no hay ningún UPDATE en este archivo que la acompañe, a propósito
   * (`scripts/reconcileCredits.ts` nunca repara, solo reporta).
   */
  reconciliationDiscrepancies: q<{
    id: UUID;
    community_id: UUID;
    credits_balance: DbNumber;
    credits_locked: DbNumber;
    ledger_balance: DbNumber;
    ledger_locked: DbNumber;
  }>(
    "credit.reconciliationDiscrepancies",
    `SELECT u.id, u.community_id, u.credits_balance, u.credits_locked,
            COALESCE(SUM(w.balance_delta), 0) AS ledger_balance,
            COALESCE(SUM(w.locked_delta),  0) AS ledger_locked
       FROM users u
       LEFT JOIN wallet_transactions w ON w.user_id = u.id
      GROUP BY u.id, u.community_id, u.credits_balance, u.credits_locked
     HAVING u.credits_balance <> COALESCE(SUM(w.balance_delta), 0)
         OR u.credits_locked  <> COALESCE(SUM(w.locked_delta),  0)`,
  ),

  /**
   * Filas retenidas de usuarios ya borrados (account-deletion-integrity: "Reconciliation ignores
   * orphaned rows"). No son una discrepancia — es historial anonimizado a propósito — así que se
   * reportan aparte, nunca contra `reconciliationDiscrepancies`.
   */
  reconciliationOrphanedLedgerTotals: q<{
    community_id: UUID;
    rows: DbNumber;
    balance_delta_total: DbNumber;
    locked_delta_total: DbNumber;
  }>(
    "credit.reconciliationOrphanedLedgerTotals",
    `SELECT community_id, COUNT(*) AS rows,
            COALESCE(SUM(balance_delta), 0) AS balance_delta_total,
            COALESCE(SUM(locked_delta), 0)  AS locked_delta_total
       FROM wallet_transactions
      WHERE user_id IS NULL
      GROUP BY community_id`,
  ),

  /**
   * Toma en una sola sentencia el listing principal y todos los tradeados (design D3 regla 2):
   * `FOR UPDATE` los bloquea desde acá, antes de cualquier movimiento de crédito, y `ORDER BY id`
   * fija el orden de lock sin importar en qué orden llegaron `tradingListingIds`.
   */
  listingsByIdsForUpdate: (_ids: UUID[]) =>
    q<DB_Listings>(
      "listing.byIdsForUpdate",
      `SELECT * FROM listings
       WHERE id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)
       ORDER BY id
       FOR UPDATE`,
    ),

  /** Lectura en lote sin lock: usada para leer precios de listings tradeados (no se van a escribir). */
  listingsByIds: (_ids: UUID[]) =>
    q<DB_Listings>(
      "listing.byIds",
      `SELECT * FROM listings
       WHERE id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),

  /**
   * Loops abiertos donde el usuario es vendedor (account-deletion-integrity: "Third-Party Credits
   * Are Released"). Se leen ANTES de `deleteListingsBySellerId`, que borra sin filtro de estado —
   * es la única forma de saber a quién hay que devolverle el crédito bloqueado antes de que la fila
   * desaparezca.
   */
  listingsBySellerIdOpen: q<DB_Listings>(
    "listings.bySellerIdOpen",
    `SELECT * FROM listings
     WHERE seller_id = $1 AND listing_status IN ('offered', 'accepted')
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  /** Igual que `listingsBySellerIdOpen`, para el rol de comprador. */
  listingsByBuyerIdOpen: q<DB_Listings>(
    "listings.byBuyerIdOpen",
    `SELECT * FROM listings
     WHERE buyer_id = $1 AND listing_status IN ('offered', 'accepted')
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  storeTrade: q<void>(
    "trades.newTrade",
    `INSERT INTO listing_trades (listing_id, trade_listing_id, community_id)
    VALUES ($1, $2, $3);`,
  ),

  tradesByListingId: q<DB_ListingTrades>(
    "trades.byListingId",
    `SELECT * FROM listing_trades
     WHERE listing_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  deleteTradesByListingId: q<void>(
    "trades.deleteByListingId",
    `DELETE FROM listing_trades
     WHERE listing_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  /** Guardado: solo una oferta `offered` del vendedor dueño puede pasar a `accepted`. */
  acceptOffer: q<DB_Listings>(
    "listing.acceptOffer",
    `UPDATE listings SET listing_status = 'accepted'
    WHERE id = $1 AND listing_status = 'offered' AND seller_id = $3
      AND ($2::uuid IS NULL OR community_id = $2::uuid)
    RETURNING *;`,
  ),

  // `updateListingStatus` (sin guard, 3 columnas libres) se eliminó: era la única consumidora la
  // `cancelListing` vieja, que tenía un bug de aridad documentado y nunca corrió en producción.
  // `cancelAcceptedListing` la reemplaza, guardada y con las reglas propias de la transición.

  /**
   * ECO-05 (design D7, transiciones 7 y 8): vuelve un loop `accepted` a `published` sin comprador.
   * Cualquiera de las dos partes puede cancelar, así que el guard acepta `seller_id = $actor OR
   * buyer_id = $actor` en lugar de exigir un rol fijo.
   */
  cancelAcceptedListing: q<DB_Listings>(
    "listing.cancelAccepted",
    `UPDATE listings
        SET listing_status = 'published', buyer_id = NULL, offered_credits = NULL
      WHERE id = $1 AND listing_status = 'accepted'
        AND (seller_id = $2 OR buyer_id = $2)
        AND ($3::uuid IS NULL OR community_id = $3::uuid)
      RETURNING *;`,
  ),

  /** Devuelve al mercado los listings tradeados de un loop cancelado (design D7). */
  revertTradedListings: (ids: UUID[]) =>
    q<void>(
      "listing.revertTraded",
      `UPDATE listings SET listing_status = 'published', buyer_id = NULL, offered_credits = NULL
       WHERE id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),

  /**
   * Guardado (corrección de audit #2 en design.md): cada listing tradeado tiene que seguir
   * `published`, sin comprador y perteneciente al comprador de la oferta principal en el instante
   * mismo del claim, no en una lectura anterior sin lock. Cero filas para cualquiera de los
   * tradeados hace fallar toda la aceptación con 409.
   */
  markListingAsSold: q<DB_Listings>(
    "listing.markAsSold",
    `UPDATE listings SET listing_status = 'accepted', buyer_id = $1
    WHERE id = $2 AND listing_status = 'published' AND buyer_id IS NULL AND seller_id = $4
      AND ($3::uuid IS NULL OR community_id = $3::uuid)
    RETURNING *;`,
  ),

  /** Guardado: solo el comprador dueño puede recibir un loop `accepted` (D7 transición 6). */
  markListingAsReceived: q<DB_Listings>(
    "listing.markAsReceived",
    `UPDATE listings SET listing_status = 'received'
    WHERE id = $1 AND listing_status = 'accepted' AND buyer_id = $3
      AND ($2::uuid IS NULL OR community_id = $2::uuid)
    RETURNING *;`,
  ),

  newMessage: q<{ id: UUID }>(
    "message.new",
    `INSERT INTO messages (sender_id, recipient_id, text, attached_listing_id, community_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;`,
  ),

  messagesBySenderAndRecipient: q<DB_Messages & DB_Pagination>(
    "message.bySenderAndRecipient",
    `SELECT *, COUNT(*) OVER() AS total_records
    FROM messages
    WHERE ((sender_id = $1 AND recipient_id = $2)
        OR (sender_id = $2 AND recipient_id = $1))
      AND ($5::uuid IS NULL OR community_id = $5::uuid)
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4;`,
  ),

  unreadChatsCountByUserId: q<{ unread_count: number }>(
    "message.unreadCount",
    `SELECT COUNT(DISTINCT sender_id) AS unread_count
    FROM messages
    WHERE recipient_id = $1 AND is_read = false
      AND ($2::uuid IS NULL OR community_id = $2::uuid);`,
  ),

  unreadNotificationsCountByUserId: q<{ unread_count: number }>(
    "notifications.unreadCount",
    `SELECT COUNT(*) AS unread_count
    FROM notifications
    WHERE user_id = $1 AND is_read = false
      AND ($2::uuid IS NULL OR community_id = $2::uuid);`,
  ),

  uploadFile: q<{ id: UUID }>(
    "media.insert",
    `INSERT INTO media (url, mime, media_type, uploaded_by, community_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;`,
  ),

  listings: ({ sort, order }: { sort: SortColumn; order: SortDirection }) =>
    q<DB_Listings & DB_Pagination>(
      "listing.byUserId",
      `SELECT
        *,
        COUNT(*) OVER() as total_records
    FROM listings
    WHERE
        -- comunidad (aislamiento)
        ($10::uuid IS NULL OR community_id = $10::uuid)

        -- searchTerm: busca en título o descripción
        AND ($1::text IS NULL OR $1::text = '' OR
            LOWER(title) LIKE LOWER(CONCAT('%', $1::text, '%')) ESCAPE '\\' OR
            LOWER(description) LIKE LOWER(CONCAT('%', $1::text, '%')) ESCAPE '\\')

        -- listingStatus
        AND (
          ($2::listing_status IS NULL AND listing_status != 'received')
          OR
          ($2::listing_status IS NOT NULL AND listing_status = $2::listing_status)
        )

        -- categoryId
        AND ($3::uuid IS NULL OR category_id = $3::uuid)

        -- productStatus
        AND ($4::product_status IS NULL OR product_status = $4::product_status)

        -- userId (vendedor)
        AND ($5::uuid IS NULL OR seller_id = $5::uuid)

        -- buyerId (comprador)
        AND ($6::uuid IS NULL OR buyer_id = $6::uuid)

        -- Seller or Buyer
        AND ($7::uuid IS NULL OR seller_id = $7::uuid OR buyer_id = $7::uuid)

    ORDER BY ${sort} ${order}
    LIMIT $8 OFFSET $9;`,
    ),

  // Catálogo compartido
  missionTemplateByKey: q<DB_MissionTemplates>(
    "missionsTemplates.byKey",
    `SELECT * FROM mission_templates WHERE key = $1`,
  ),
  /** Panel de admin: intencionalmente incluye inactivas, para poder reactivarlas. */
  allMissionTemplates: q<DB_MissionTemplates>(
    "missionsTemplates.all",
    `SELECT * FROM mission_templates`,
  ),
  /**
   * Solo las activas (ECO-11/mission-progress): la asignación a un usuario nuevo o el fan-out a
   * toda la comunidad nunca deben crear filas para una plantilla inactiva. Es una query separada de
   * `allMissionTemplates` a propósito — esa la sigue usando el panel de admin para poder reactivar
   * una plantilla, y filtrarla ahí la volvería invisible para siempre.
   */
  activeMissionTemplates: q<DB_MissionTemplates>(
    "missionsTemplates.active",
    `SELECT * FROM mission_templates WHERE active = true`,
  ),
  missionTemplatesByIds: (ids: UUID[]) =>
    q<DB_MissionTemplates>(
      "missionTemplates.byIds",
      `SELECT * FROM mission_templates WHERE id = ANY($1::uuid[])`,
    ),

  userMissionsByUserIdAndTemplateId: q<DB_UserMissions>(
    "userMissions.byUserIdAndTemplateId",
    `SELECT * FROM user_missions
     WHERE user_id = $1 AND mission_template_id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),
  /**
   * `completed_at` solo se fija la primera vez que la misión queda completa (mission-progress:
   * "Completion Timestamp Records Completion"): `COALESCE` preserva la fecha original si ya estaba
   * completa, y el `CASE` no la toca en absoluto cuando este tick no completa nada.
   * `AND completed = false` es el guard que hace que el conteo de filas afectadas decida si se
   * otorga la recompensa (mission-progress: "A Mission Rewards Once") — cero filas significa que
   * otro request ya la completó primero.
   */
  progressMission: q<DB_UserMissions>(
    "missions.progressMission",
    `UPDATE user_missions
        SET progress = $1,
            completed = $2,
            completed_at = CASE WHEN $2 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
     WHERE id = $3 AND completed = false
       AND ($4::uuid IS NULL OR community_id = $4::uuid)
     RETURNING *`,
  ),
  assignMissionToUser: q<{ id: UUID }>(
    "missions.assignToUser",
    `INSERT INTO user_missions (user_id, mission_template_id, progress, completed, community_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, mission_template_id) DO NOTHING
     RETURNING id`,
  ),

  /**
   * Fan-out set-based (mission-progress: "Set-Based, Idempotent Fan-Out", design D11). Reemplaza el
   * loop `2 + 2·U` de `assignMissionToAllUsers` (`utils/helpersDb.ts`, antes con una ventana
   * SELECT→INSERT que duplicaba filas si dos admins lo disparaban a la vez): un solo INSERT que
   * ignora a quien ya tiene la fila, apoyado en `uq_user_missions_user_template` (migración `0014`).
   * `$3` es `null` para un super admin — así alcanza a todas las comunidades a la vez, que es el
   * comportamiento actual documentado en `helpersDb.ts`.
   */
  assignMissionToAllUsersSetBased: q<void>(
    "missions.assignToAllUsersSetBased",
    `INSERT INTO user_missions (user_id, mission_template_id, progress, completed, community_id)
     SELECT u.id, $1, $2::jsonb, false, u.community_id
       FROM users u
      WHERE ($3::uuid IS NULL OR u.community_id = $3::uuid)
     ON CONFLICT (user_id, mission_template_id) DO NOTHING`,
  ),

  // ─── Comunidades ──────────────────────────────────────────────────────────

  communityById: q<DB_Communities>("community.byId", `SELECT * FROM communities WHERE id = $1`),

  communityBySlug: q<DB_Communities>(
    "community.bySlug",
    `SELECT * FROM communities WHERE slug = lower($1)`,
  ),

  /**
   * Resuelve la comunidad a partir del dominio del correo. Es lo que reemplazó a la constante
   * `VALID_EMAIL_DOMAINS`, que estaba hardcodeada y duplicada en cliente y servidor.
   */
  communityByDomain: q<DB_Communities>(
    "community.byDomain",
    `SELECT c.*
     FROM communities c
     JOIN community_email_domains d ON d.community_id = c.id
     WHERE d.domain = lower($1) AND c.active = TRUE`,
  ),

  communitiesByIds: (ids: UUID[]) =>
    q<DB_Communities>("communities.byIds", `SELECT * FROM communities WHERE id = ANY($1::uuid[])`),

  allCommunities: q<DB_Communities>(
    "communities.all",
    `SELECT * FROM communities ORDER BY name ASC`,
  ),

  createCommunity: q<DB_Communities>(
    "community.create",
    `INSERT INTO communities (slug, name, media_id, theme)
     VALUES (lower($1), $2, $3, $4::jsonb)
     RETURNING *`,
  ),

  /**
   * `$6` distingue "no mandaron el campo" de "lo mandaron en null". Sin esa bandera, un `COALESCE`
   * haría imposible sacarle el logo a una comunidad: `null` se leería como "no cambiar".
   */
  updateCommunity: q<DB_Communities>(
    "community.update",
    `UPDATE communities
     SET name = COALESCE($1, name),
         media_id = CASE WHEN $6::boolean THEN $2::uuid ELSE media_id END,
         theme = COALESCE($3::jsonb, theme),
         active = COALESCE($4, active),
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
  ),

  /** Siembra las 3 filas de stats ambientales de una comunidad recién creada. */
  seedCommunityStats: q<void>(
    "community.seedStats",
    `INSERT INTO global_stats (stat_name, stat_value, community_id)
     VALUES ('total_kg_waste', 0, $1), ('total_kg_co2', 0, $1), ('total_l_h2o', 0, $1)
     ON CONFLICT (community_id, stat_name) DO NOTHING`,
  ),

  communityDomains: q<DB_CommunityEmailDomains>(
    "community.domains",
    `SELECT * FROM community_email_domains WHERE community_id = $1 ORDER BY domain ASC`,
  ),

  allCommunityDomains: q<DB_CommunityEmailDomains>(
    "community.allDomains",
    `SELECT * FROM community_email_domains ORDER BY domain ASC`,
  ),

  createCommunityDomain: q<DB_CommunityEmailDomains>(
    "community.createDomain",
    `INSERT INTO community_email_domains (community_id, domain)
     VALUES ($1, lower($2)) RETURNING *`,
  ),

  deleteCommunityDomain: q<{ id: UUID }>(
    "community.deleteDomain",
    `DELETE FROM community_email_domains WHERE id = $1 AND community_id = $2 RETURNING id`,
  ),

  communityCounts: q<{ users: string; listings: string; schools: string }>(
    "community.counts",
    `SELECT
       (SELECT COUNT(*) FROM users    WHERE community_id = $1)::text AS users,
       (SELECT COUNT(*) FROM listings WHERE community_id = $1)::text AS listings,
       (SELECT COUNT(*) FROM schools  WHERE community_id = $1)::text AS schools`,
  ),

  /** Cuántos de los colegios pedidos pertenecen realmente a la comunidad. */
  countSchoolsInCommunity: q<{ count: string }>(
    "community.countSchoolsIn",
    `SELECT COUNT(*)::text AS count
     FROM schools
     WHERE id = ANY($1::uuid[]) AND community_id = $2`,
  ),

  // ─── Invitaciones ─────────────────────────────────────────────────────────

  /**
   * `FOR UPDATE` es lo que garantiza el uso único: dentro de la transacción del registro, dos
   * pedidos simultáneos con el mismo token se serializan y el segundo ya ve `used_by_user_id`.
   */
  invitationByTokenForUpdate: q<DB_Invitations>(
    "invitation.byTokenForUpdate",
    `SELECT * FROM invitations WHERE token = $1 FOR UPDATE`,
  ),

  invitationByToken: q<DB_Invitations>(
    "invitation.byToken",
    `SELECT * FROM invitations WHERE token = $1`,
  ),

  createInvitation: q<DB_Invitations>(
    "invitation.create",
    `INSERT INTO invitations (token, community_id, created_by_admin_id, note, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
  ),

  /** El `AND used_by_user_id IS NULL` es el cinturón de seguridad del `FOR UPDATE`. */
  consumeInvitation: q<{ id: UUID }>(
    "invitation.consume",
    `UPDATE invitations SET used_by_user_id = $1, used_at = NOW()
     WHERE id = $2 AND used_by_user_id IS NULL
     RETURNING id`,
  ),

  invitationsByCommunity: q<DB_Invitations & DB_Pagination>(
    "invitation.byCommunity",
    `SELECT *, COUNT(*) OVER() AS total_records
     FROM invitations
     WHERE ($1::uuid IS NULL OR community_id = $1::uuid)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
  ),

  deleteUnusedInvitation: q<{ id: UUID }>(
    "invitation.deleteUnused",
    `DELETE FROM invitations
     WHERE id = $1 AND used_by_user_id IS NULL
       AND ($2::uuid IS NULL OR community_id = $2::uuid)
     RETURNING id`,
  ),

  // ─── Solicitudes de borrado de cuenta ─────────────────────────────────────

  /** Idempotente: pedir el borrado dos veces no acumula solicitudes pendientes. */
  createAccountDeletionRequest: q<DB_AccountDeletionRequests>(
    "accountDeletion.create",
    `INSERT INTO account_deletion_requests (user_id, community_id, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) WHERE status = 'pending' DO NOTHING
     RETURNING *`,
  ),

  accountDeletionRequestsByStatus: q<DB_AccountDeletionRequests & DB_Pagination>(
    "accountDeletion.byStatus",
    `SELECT *, COUNT(*) OVER() AS total_records
     FROM account_deletion_requests
     WHERE status = COALESCE($1::account_deletion_status, 'pending')
       AND ($2::uuid IS NULL OR community_id = $2::uuid)
     ORDER BY created_at ASC
     LIMIT $3 OFFSET $4`,
  ),

  accountDeletionRequestById: q<DB_AccountDeletionRequests>(
    "accountDeletion.byId",
    `SELECT * FROM account_deletion_requests
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  resolveAccountDeletionRequest: q<{ id: UUID }>(
    "accountDeletion.resolve",
    `UPDATE account_deletion_requests
     SET status = $1::account_deletion_status, resolved_by_admin_id = $2, resolved_at = NOW()
     WHERE id = $3 AND status = 'pending'
     RETURNING id`,
  ),

  deleteAccountDeletionRequestsByUserId: q<void>(
    "accountDeletion.deleteByUserId",
    `DELETE FROM account_deletion_requests WHERE user_id = $1`,
  ),

  // ─── Admin ────────────────────────────────────────────────────────────────
  // Estas queries corren con la conexión unscoped; el scope real lo pone el rol del admin, que
  // se pasa como parámetro de comunidad (null para un super admin).

  adminByEmail: q<DB_Admin & { password: string }>(
    "admin.byEmail",
    `SELECT * FROM admins WHERE lower(email) = lower($1)`,
  ),
  createAdmin: q<DB_Admin>(
    "admin.create",
    `INSERT INTO admins (email, full_name, password, google_id, role, community_id)
     VALUES (lower($1), $2, $3, $4, $5, $6) RETURNING *`,
  ),
  addValidEmailForAdminRegistration: q<void>(
    "admin.addValidEmail",
    `INSERT INTO admin_valid_emails (email, role, community_id) VALUES (lower($1), $2, $3)`,
  ),
  ensureAuthorizedAdminEmail: q<void>(
    "admin.ensureAuthorized",
    `INSERT INTO admin_valid_emails (email, role, community_id)
     VALUES (lower($1), 'super_admin', NULL) ON CONFLICT (email) DO NOTHING`,
  ),
  validEmailForAdminRegistration: q<DB_AdminValidEmails>(
    "admin.validEmail",
    `SELECT * FROM admin_valid_emails WHERE lower(email) = lower($1)`,
  ),
  updateAdminGoogleId: q<void>(
    "admin.updateGoogleId",
    `UPDATE admins SET google_id = $1 WHERE id = $2`,
  ),
  countSuperAdmins: q<{ count: number }>(
    "admin.countSuperAdmins",
    `SELECT count(*)::int AS count FROM admins WHERE role = 'super_admin'`,
  ),

  createNotification: q<DB_Notifications>(
    "notifications.create",
    `INSERT INTO notifications (user_id, type, payload, is_read, community_id)
     VALUES ($1, $2, $3, FALSE, $4) RETURNING *`,
  ),
  updateNotificationToken: q<void>(
    "notifications.updateToken",
    `UPDATE users SET notification_token = $1
     WHERE id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),

  adminSearchUsers: q<DB_Users & DB_Pagination>(
    "admin.searchUsers",
    `SELECT
      u.*,
      COUNT(*) OVER() as total_records
    FROM users u
    WHERE LOWER(u.first_name || ' ' || u.last_name || ' ' || u.email) LIKE LOWER($1) ESCAPE '\\'
      AND ($4::uuid IS NULL OR u.community_id = $4::uuid)
    ORDER BY u.created_at DESC
    LIMIT $2 OFFSET $3`,
  ),
  getAllUsersAdmin: q<DB_Users & DB_Pagination>(
    "admin.getAllUsers",
    `SELECT
      u.*,
      COUNT(*) OVER() as total_records
    FROM users u
    WHERE ($1::uuid IS NULL OR u.community_id = $1::uuid)
    ORDER BY u.created_at DESC`,
  ),

  // `createWalletTransaction`, `increaseUserBalance` y `decreaseUserBalance` se eliminaron
  // (credit-ledger: Single Mutation Choke Point). El ajuste manual del admin ahora pasa por
  // `applyCreditMovements`, igual que todo lo demás — `decreaseUserBalance` no tenía piso y podía
  // dejar un saldo negativo antes de que el CHECK de `0010` lo detectara con un 500 sucio.
  createSchool: q<DB_Schools>(
    "admin.createSchool",
    `INSERT INTO schools (name, media_id, community_id) VALUES ($1, $2, $3) RETURNING *`,
  ),
  updateSchool: q<DB_Schools>(
    "admin.updateSchool",
    `UPDATE schools SET name = $1, media_id = $2
     WHERE id = $3
       AND ($4::uuid IS NULL OR community_id = $4::uuid)
     RETURNING *`,
  ),

  // Catálogos compartidos: solo los edita un super admin.
  createCategory: q<DB_Categories>(
    "admin.createCategory",
    `INSERT INTO categories (name, description, parent_id, icon, min_price_credits, max_price_credits, stat_kg_waste, stat_kg_co2, stat_l_h2o)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
  ),
  updateCategory: q<DB_Categories>(
    "admin.updateCategory",
    `UPDATE categories SET name = $1, description = $2, parent_id = $3, icon = $4, min_price_credits = $5, max_price_credits = $6, stat_kg_waste = $7, stat_kg_co2 = $8, stat_l_h2o = $9
    WHERE id = $10 RETURNING *`,
  ),
  createMissionTemplate: q<DB_MissionTemplates>(
    "admin.createMissionTemplate",
    `INSERT INTO mission_templates (key, title, description, reward_credits, active)
    VALUES ($1, $2, $3, $4, $5) RETURNING *`,
  ),
  updateMissionTemplate: q<DB_MissionTemplates>(
    "admin.updateMissionTemplate",
    `UPDATE mission_templates SET title = $1, description = $2, reward_credits = $3, active = $4
    WHERE id = $5 RETURNING *`,
  ),

  getGlobalStats: q<DB_GlobalStats>(
    "admin.getGlobalStats",
    `SELECT * FROM global_stats WHERE ($1::uuid IS NULL OR community_id = $1::uuid)`,
  ),
  getSchoolStats: q<DB_Schools>(
    "admin.getSchoolStats",
    `SELECT id, name, community_id, stat_kg_waste, stat_kg_co2, stat_l_h2o
     FROM schools
     WHERE ($1::uuid IS NULL OR community_id = $1::uuid)
     ORDER BY name ASC`,
  ),

  getUserWishesByUserId: q<DB_UsersWishes>(
    "userWishes.byUserId",
    `SELECT * FROM users_wishes
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  userWishById: q<DB_UsersWishes>(
    "userWishes.byId",
    `SELECT * FROM users_wishes
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  createUserWish: q<DB_UsersWishes>(
    "userWishes.create",
    `INSERT INTO users_wishes (user_id, category_id, comment, community_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
  ),
  removeUserWish: q<void>(
    "userWishes.remove",
    `DELETE FROM users_wishes
     WHERE user_id = $1 AND category_id = $2
       AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),
  updateUserWish: q<void>(
    "userWishes.update",
    `UPDATE users_wishes SET comment = $1, category_id = $2
     WHERE id = $3
       AND ($4::uuid IS NULL OR community_id = $4::uuid)`,
  ),

  increaseUserStats: q<void>(
    "user.increaseStats",
    `UPDATE users SET stat_kg_waste = stat_kg_waste + $1, stat_kg_co2 = stat_kg_co2 + $2, stat_l_h2o = stat_l_h2o + $3
     WHERE id = $4
       AND ($5::uuid IS NULL OR community_id = $5::uuid)`,
  ),
  increaseSchoolStats: q<void>(
    "school.increaseStats",
    `UPDATE schools SET stat_kg_waste = stat_kg_waste + $1, stat_kg_co2 = stat_kg_co2 + $2, stat_l_h2o = stat_l_h2o + $3
     WHERE id = $4
       AND ($5::uuid IS NULL OR community_id = $5::uuid)`,
  ),
  /**
   * El filtro de comunidad acá **no es opcional**: `global_stats` pasó a tener 3 filas por
   * comunidad, y sin él un loop completado sumaría su impacto al de todas las comunidades.
   */
  increaseGlobalStats: q<void>(
    "global.increaseStats",
    `UPDATE global_stats
    SET stat_value = stat_value +
      CASE
        WHEN stat_name = 'total_kg_waste' THEN $1::float8
        WHEN stat_name = 'total_kg_co2' THEN $2::float8
        WHEN stat_name = 'total_l_h2o' THEN $3::float8
        ELSE 0
      END
    WHERE stat_name IN ('total_kg_waste', 'total_kg_co2', 'total_l_h2o')
      AND community_id = $4::uuid`,
  ),

  // ─── Borrado de usuario (cascada manual) ──────────────────────────────────

  deleteMessagesByUserId: q<void>(
    "messages.deleteByUserId",
    `DELETE FROM messages
     WHERE (sender_id = $1 OR recipient_id = $1)
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  setMessagesAttachedListingNullBySellerId: q<void>(
    "messages.setAttachedListingNullBySellerId",
    `UPDATE messages SET attached_listing_id = NULL
     WHERE attached_listing_id IN (SELECT id FROM listings WHERE seller_id = $1)
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  deleteNotificationsByUserId: q<void>(
    "notifications.deleteByUserId",
    `DELETE FROM notifications
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  deleteUserMissionsByUserId: q<void>(
    "userMissions.deleteByUserId",
    `DELETE FROM user_missions
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  deleteListingTradesByListingIds: (ids: UUID[]) =>
    q<void>(
      "listingTrades.deleteByListingIds",
      `DELETE FROM listing_trades
       WHERE (listing_id = ANY($1::uuid[]) OR trade_listing_id = ANY($1::uuid[]))
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),
  /**
   * `AND listing_status IN ('offered','accepted')` (account-deletion-integrity: "A settled loop is
   * not reopened"): sin este filtro, borrar un comprador reabría también sus loops `received` —
   * ya liquidados, terminales — de vuelta a `published`.
   */
  updateListingsBuyerToNullByUserId: q<void>(
    "listings.updateBuyerToNullByUserId",
    `UPDATE listings SET buyer_id = NULL, listing_status = 'published', offered_credits = NULL
     WHERE buyer_id = $1 AND listing_status IN ('offered', 'accepted')
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  deleteListingsBySellerId: q<void>(
    "listings.deleteBySellerId",
    `DELETE FROM listings
     WHERE seller_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  // `deleteWalletTransactionsByUserId` se eliminó (account-deletion-integrity: "The Ledger Survives
  // Deletion"). La FK compuesta de `wallet_transactions` ahora es `ON DELETE SET NULL (user_id)`
  // (migración `0014`), así que borrar el usuario anonimiza sus filas del ledger en vez de
  // destruirlas — necesario para que la reconciliación y el historial de la contraparte sigan
  // siendo auditables después de un borrado.
  deleteUserSchoolsByUserId: q<void>(
    "userSchools.deleteByUserId",
    `DELETE FROM user_schools
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  deleteUserWishesByUserId: q<void>(
    "userWishes.deleteByUserId",
    `DELETE FROM users_wishes
     WHERE user_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  updateMediaUploadedByToNullByUserId: q<void>(
    "media.updateUploadedByToNullByUserId",
    `UPDATE media SET uploaded_by = NULL
     WHERE uploaded_by = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  /** Desvincula al usuario de su invitación antes de borrarlo, para no romper la FK. */
  clearInvitationUserByUserId: q<void>(
    "invitation.clearUser",
    `UPDATE invitations SET used_by_user_id = NULL WHERE used_by_user_id = $1`,
  ),
  deleteUserById: q<void>(
    "user.deleteById",
    `DELETE FROM users
     WHERE id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),
  listingIdsBySellerId: q<{ id: UUID }>(
    "listings.idsBySellerId",
    `SELECT id FROM listings
     WHERE seller_id = $1
       AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
  ),

  // ─── Lookups por lote ─────────────────────────────────────────────────────

  schoolsByIds: (ids: UUID[]) =>
    q<DB_Schools>(
      "schools.byIds",
      `SELECT * FROM schools
       WHERE id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),
  usersByIds: (ids: UUID[]) =>
    q<DB_Users>(
      "users.byIds",
      `SELECT * FROM users
       WHERE id = ANY($1::uuid[])
         AND ($2::uuid IS NULL OR community_id = $2::uuid)`,
    ),

  /** Mueve un usuario de comunidad. Solo super admin, y solo si no tiene actividad (ver AdminModel). */
  moveUserToCommunity: q<void>(
    "admin.moveUserToCommunity",
    `UPDATE users SET community_id = $1, updated_at = NOW() WHERE id = $2`,
  ),
  /** Cuenta la actividad de un usuario, para decidir si se lo puede mover de comunidad. */
  userContentCounts: q<{ total: string }>(
    "user.contentCounts",
    `SELECT (
       (SELECT COUNT(*) FROM listings           WHERE seller_id = $1 OR buyer_id = $1) +
       (SELECT COUNT(*) FROM messages           WHERE sender_id = $1 OR recipient_id = $1) +
       (SELECT COUNT(*) FROM wallet_transactions WHERE user_id = $1) +
       (SELECT COUNT(*) FROM users_wishes       WHERE user_id = $1)
     )::text AS total`,
  ),

  // ─── Legal / public routes (`legal-public-routes`) ────────────────────────

  /** Registra la aceptación de los términos vigentes. Scopeada: escribe la fila del propio caller. */
  acceptTerms: q<void>(
    "user.acceptTerms",
    `UPDATE users
        SET terms_accepted_at = NOW(), terms_version = $1
      WHERE id = $2
        AND ($3::uuid IS NULL OR community_id = $3::uuid)`,
  ),

  /**
   * Emite un nuevo token de reseteo de password, pisando cualquiera pendiente — así pedir un reset
   * nuevo invalida el anterior (spec `password-reset`, "New request invalidates the old token").
   * Sin filtro de comunidad: todavía no sabemos de qué comunidad es quien pide el reset.
   */
  setPasswordResetToken: q<void>(
    "user.setPasswordResetToken",
    `UPDATE users
        SET password_reset_token_hash = $1,
            password_reset_expires_at = NOW() + INTERVAL '1 hour'
      WHERE id = $2`,
  ),

  /**
   * Consume el token en un único `UPDATE ... RETURNING` atómico: matchea por hash, exige que no
   * haya vencido, y limpia hash + expiración en la misma sentencia, así dos envíos concurrentes
   * con el mismo token no pueden ganar los dos (spec `password-reset`, "Concurrent submissions").
   * También marca `email_verified = TRUE`: probar la casilla alcanza (design D6).
   */
  consumePasswordResetToken: q<{ id: UUID }>(
    "user.consumePasswordResetToken",
    `UPDATE users
        SET password = $1,
            password_reset_token_hash = NULL,
            password_reset_expires_at = NULL,
            email_verified = TRUE
      WHERE password_reset_token_hash = $2
        AND password_reset_expires_at > NOW()
      RETURNING id`,
  ),
} as const;
