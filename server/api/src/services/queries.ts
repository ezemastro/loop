import type { NamedQuery } from "../types/dbClient.js";

// Helper para crear queries nombradas
const q = <T>(key: string, text: string): NamedQuery<T> => ({
  key,
  text,
});

export const queries = {
  userExists: q<{ user_exists: boolean }>(
    "user.exists",
    `SELECT EXISTS(
       SELECT 1 FROM users WHERE email = $1
     ) AS user_exists`,
  ),

  insertUser: q<{ id: UUID }>(
    "user.insert",
    `INSERT INTO users (email, first_name, last_name, password, school_id, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
  ),

  schoolById: q<DB_Schools>(
    "school.byId",
    `SELECT * FROM schools WHERE id = $1`,
  ),

  roleById: q<DB_Roles>("role.byId", `SELECT * FROM roles WHERE id = $1`),

  userByEmail: q<DB_Users>(
    "user.byEmail",
    `SELECT * FROM users WHERE email = $1`,
  ),

  userById: q<DB_Users>("user.byId", `SELECT * FROM users WHERE id = $1`),

  mediaById: q<DB_Media>("media.byId", `SELECT * FROM media WHERE id = $1`),

  updateUser: q<{ id: UUID }>(
    "user.update",
    `UPDATE users SET email = $1, first_name = $2, last_name = $3, phone = $4, profile_media_id = $5, password = $6
       WHERE id = $7
       RETURNING id`,
  ),

  userMissionsByUserId: q<DB_UserMissions>(
    "missions.byUserId",
    `SELECT * FROM user_missions WHERE user_id = $1`,
  ),

  userMissionsById: q<DB_UserMissions>(
    "missions.byId",
    `SELECT * FROM user_missions WHERE id = $1`,
  ),

  missionTemplateById: q<DB_MissionTemplates>(
    "missions.templateById",
    `SELECT * FROM template_missions WHERE id = $1`,
  ),

  notificationsByUserId: q<DB_Notifications>(
    "notifications.byUserId",
    `SELECT * FROM notifications WHERE user_id = $1`,
  ),

  listingById: q<DB_Listings>(
    "listings.byId",
    `SELECT * FROM listings WHERE id = $1`,
  ),

  deleteListingById: q<DB_Listings>(
    "listings.deleteById",
    `DELETE FROM listings WHERE id = $1 AND seller_id = $2`,
  ),

  listingMediasByListingId: q<DB_ListingMedia>(
    "listings.mediasById",
    `SELECT * FROM listing_media WHERE listing_id = $1`,
  ),

  categoryById: q<DB_Categories>(
    "categories.byId",
    `SELECT * FROM categories WHERE id = $1`,
  ),

  categoriesByParentId: q<DB_Categories>(
    "categories.byParentId",
    `SELECT * FROM categories WHERE parent_id = $1`,
  ),

  allCategories: q<DB_Categories>("categories.all", `SELECT * FROM categories`),

  markNotificationsAsRead: q<DB_Notifications>(
    "notifications.markAsRead",
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
  ),

  chatsByUserId: q<{
    other_user_id: UUID;
    last_message_id: UUID;
    unread_count: number;
  }>(
    "chats.byUserId",
    `SELECT 
        other_user_id,
        (SELECT m2.id 
        FROM messages m2 
        WHERE (m2.sender_id = $1 AND m2.recipient_id = other_user_id)
            OR (m2.recipient_id = $1 AND m2.sender_id = other_user_id)
        ORDER BY m2.created_at DESC 
        LIMIT 1) as last_message_id,
        unread_count
    FROM (
        SELECT 
            CASE 
                WHEN m.sender_id = $1 THEN m.recipient_id 
                ELSE m.sender_id 
            END as other_user_id,
            COUNT(CASE WHEN m.sender_id != $1 AND m.is_read = false THEN 1 END) as unread_count
        FROM messages m
        WHERE m.sender_id = $1 OR m.recipient_id = $1
        GROUP BY 
            CASE 
                WHEN m.sender_id = $1 THEN m.recipient_id 
                ELSE m.sender_id 
            END
    ) sub`,
  ),

  messageById: q<DB_Messages>(
    "messages.byId",
    `SELECT * FROM messages WHERE id = $1`,
  ),

  searchRoles: q<DB_Roles & DB_Pagination>(
    "roles.search",
    `SELECT 
        *,
        COUNT(*) OVER() as total_records
    FROM roles
    WHERE 
        -- Búsqueda por nombre (parcial, case-insensitive)
        ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
    ORDER BY
        -- Ordenamiento dinámico usando expresiones CASE
        CASE 
            WHEN $2 = 'name' AND $3 = 'asc' THEN name
            ELSE NULL
        END ASC,
        CASE 
            WHEN $2 = 'name' AND $3 = 'desc' THEN name
            ELSE NULL
        END DESC,
        -- Orden por defecto
        name DESC
    LIMIT $4
    OFFSET $5;`,
  ),

  searchUsers: q<DB_Users & DB_Pagination>(
    "users.search",
    `SELECT 
      *,
      COUNT(*) OVER() as total_records
    FROM users
    WHERE 
        ($1::text IS NULL OR $1::text = '' OR 
        LOWER(first_name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) OR 
        LOWER(last_name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) OR
        LOWER(CONCAT(first_name, ' ', last_name)) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) OR
        LOWER(CONCAT(last_name, ' ', first_name)) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')))
    AND
        ($2::text IS NULL OR $2::text = '' OR role_id::text = $2::text)
    AND
        ($3::text IS NULL OR $3::text = '' OR school_id::text = $3::text)
    ORDER BY
    CASE 
        WHEN $5 = 'asc' THEN
          CASE 
              WHEN $4 = 'id' THEN id::text
              WHEN $4 = 'first_name' THEN first_name
              WHEN $4 = 'last_name' THEN last_name
              WHEN $4 = 'email' THEN email
              WHEN $4 = 'school_id' THEN school_id::text
              WHEN $4 = 'role_id' THEN role_id::text
              WHEN $4 = 'created_at' THEN created_at::text
              ELSE created_at::text
          END
    END ASC,
    CASE 
        WHEN $5 = 'desc' THEN
          CASE 
              WHEN $4 = 'id' THEN id::text
              WHEN $4 = 'first_name' THEN first_name
              WHEN $4 = 'last_name' THEN last_name
              WHEN $4 = 'email' THEN email
              WHEN $4 = 'school_id' THEN school_id::text
              WHEN $4 = 'role_id' THEN role_id::text
              WHEN $4 = 'created_at' THEN created_at::text
              ELSE created_at::text
          END
    END DESC
    LIMIT $6 OFFSET $7;`,
  ),

  searchSchools: q<DB_Schools & DB_Pagination>(
    "schools.search",
    `SELECT 
        *,
        COUNT(*) OVER() as total_records
    FROM schools
    WHERE 
        ($1::text IS NULL OR $1::text = '' OR 
        LOWER(name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')))
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

  // TODO - Transformar en función que reciba filtros y orden
  searchListings: ({ sort, order }: { sort: string; order: string }) =>
    q<DB_Listings & DB_Pagination>(
      "listings.search",
      `SELECT
        l.*,
        COUNT(*) OVER() as total_records,
        u.school_id
    FROM listings l
    JOIN users u ON l.seller_id = u.id
    WHERE
        NOT l.disabled = true
        AND l.listing_status = 'published'

        -- searchTerm: busca en título o descripción
        AND ($1::text IS NULL OR $1::text = '' OR
            LOWER(l.title) LIKE LOWER(CONCAT('%', $1::text, '%')) OR
            LOWER(l.description) LIKE LOWER(CONCAT('%', $1::text, '%')))

        -- categoryId
        AND ($2::uuid IS NULL OR l.category_id = $2::uuid)

        -- productStatus
        AND ($3::product_status IS NULL OR l.product_status = $3::product_status)

        -- schoolId
        AND ($4::uuid IS NULL OR u.school_id = $4::uuid)

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
    `INSERT INTO listings (title, description, price_credits, category_id, seller_id, product_status, listing_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;`,
  ),

  linkMediaToListing: q<void>(
    "listing.linkMedia",
    `INSERT INTO listing_media (listing_id, media_id)
    VALUES ($1, $2);`,
  ),

  getListingById: q<DB_Listings>(
    "listing.getById",
    `SELECT * FROM listings WHERE id = $1::UUID;`,
  ),

  updateListingById: q<void>(
    "listing.updateById",
    `UPDATE listings SET title = $1, description = $2, price_credits = $3, category_id = $4, product_status = $5
    WHERE id = $6;`,
  ),

  unlinkAllMediaFromListing: q<void>(
    "listing.unlinkAllMedia",
    `DELETE FROM listing_media WHERE listing_id = $1;`,
  ),

  newOffer: q<DB_Listings>(
    "listing.newOffer",
    `UPDATE listings SET listing_status = 'offered', offered_credits = $1, buyer_id = $2
    WHERE id = $3;`,
  ),

  deleteOffer: q<void>(
    "listing.deleteOffer",
    `UPDATE listings SET listing_status = 'published', offered_credits = NULL, buyer_id = NULL
    WHERE id = $1;`,
  ),

  updateUserBalance: q<void>(
    "user.updateBalance",
    `UPDATE users SET credits_balance = $1, credits_locked = $2 WHERE id = $3;`,
  ),

  storeTrade: q<void>(
    "trades.newTrade",
    `INSERT INTO listing_trades (listing_id, trade_listing_id)
    VALUES ($1, $2);`,
  ),

  acceptOffer: q<void>(
    "listing.acceptOffer",
    `UPDATE listings SET listing_status = 'accepted'
    WHERE id = $1;`,
  ),

  updateListingStatus: q<void>(
    "listing.updateListingStatus",
    `UPDATE listings SET listing_status = $1, buyer_id = $2, offered_credits = $3
    WHERE id = $4;`,
  ),

  markListingAsSold: q<void>(
    "listing.markAsSold",
    `UPDATE listings SET listing_status = 'accepted', buyer_id = $1, offered_credits = $2
    WHERE id = $3;`,
  ),

  markListingAsReceived: q<void>(
    "listing.markAsReceived",
    `UPDATE listings SET listing_status = 'received'
    WHERE id = $1;`,
  ),

  newMessage: q<{ id: UUID }>(
    "message.new",
    `INSERT INTO messages (sender_id, recipient_id, text, attached_listing_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id;`,
  ),

  messagesBySenderAndRecipient: q<DB_Messages & DB_Pagination>(
    "message.bySenderAndRecipient",
    `SELECT *, COUNT(*) OVER() AS total_count
    FROM messages
    WHERE (sender_id = $1 AND recipient_id = $2)
    OR (sender_id = $2 AND recipient_id = $1)
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4;`,
  ),

  unreadChatsCountByUserId: q<{ unread_count: number }>(
    "message.unreadCount",
    `SELECT COUNT(DISTINCT sender_id) AS unread_count
    FROM messages
    WHERE recipient_id = $1 AND is_read = false;`,
  ),

  unreadNotificationsCountByUserId: q<{ unread_count: number }>(
    "notifications.unreadCount",
    `SELECT COUNT(*) AS unread_count
    FROM notifications
    WHERE user_id = $1 AND is_read = false;`,
  ),

  uploadFile: q<{ id: UUID }>(
    "media.insert",
    `INSERT INTO media (url, mime, media_type, uploaded_by)
    VALUES ($1, $2, $3, $4)
    RETURNING id;`,
  ),

  listings: ({ sort, order }: { sort: string; order: "asc" | "desc" }) =>
    q<DB_Listings & DB_Pagination>(
      "listing.byUserId",
      `SELECT
        *,
        COUNT(*) OVER() as total_records
    FROM listings
    WHERE
        -- searchTerm: busca en título o descripción
        ($1::text IS NULL OR $1::text = '' OR
            LOWER(title) LIKE LOWER(CONCAT('%', $1::text, '%')) OR
            LOWER(description) LIKE LOWER(CONCAT('%', $1::text, '%')))
            
        -- listingStatus
        AND ($2::listing_status IS NULL OR listing_status = $2::listing_status)

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
} as const;
