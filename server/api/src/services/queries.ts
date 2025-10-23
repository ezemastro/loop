import type { NamedQuery } from "../types/dbClient.js";

// Helper para crear queries nombradas
const q = <T>(key: string, text: string): NamedQuery<T> => ({
  key,
  text,
});

export const queries = {
  deleteUserSchools: q<void>(
    "user_schools.delete",
    `DELETE FROM user_schools WHERE user_id = $1`,
  ),

  insertUserSchools: (schoolCount: number) =>
    q<void>(
      "user_schools.insertMany",
      `INSERT INTO user_schools (user_id, school_id) VALUES ${Array(schoolCount)
        .fill(0)
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ")}`,
    ),
  userExists: q<{ user_exists: boolean }>(
    "user.exists",
    `SELECT EXISTS(
       SELECT 1 FROM users WHERE email = $1
     ) AS user_exists`,
  ),

  insertUser: q<{ id: UUID }>(
    "user.insert",
    `INSERT INTO users (email, first_name, last_name, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
  ),

  schoolById: q<DB_Schools>(
    "school.byId",
    `SELECT * FROM schools WHERE id = $1`,
  ),

  userByEmail: q<DB_Users>(
    "user.byEmail",
    `SELECT * FROM users WHERE email = $1`,
  ),

  userById: q<DB_Users>("user.byId", `SELECT * FROM users WHERE id = $1`),

  userSchoolsByUserId: q<DB_UserSchools>(
    "user.schoolsByUserId",
    `SELECT * FROM user_schools WHERE user_id = $1`,
  ),

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
    `SELECT * FROM mission_templates WHERE id = $1`,
  ),

  notificationsByUserId: q<DB_Notifications & DB_Pagination>(
    "notifications.byUserId",
    `SELECT 
      *,
      COUNT(*) OVER() as total_records
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
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

  markNotificationsAsRead: q(
    "notifications.markAsRead",
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
  ),

  markMessagesAsRead: q(
    "messages.markAsRead",
    `UPDATE messages SET is_read = TRUE WHERE recipient_id = $1 AND sender_id = $2`,
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
        WHERE (m2.sender_id = $1 AND m2.recipient_id = sub.other_user_id)
            OR (m2.recipient_id = $1 AND m2.sender_id = sub.other_user_id)
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
        WHERE m.sender_id = $1 OR m.recipient_id = $1
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
    `SELECT * FROM messages WHERE id = $1`,
  ),

  searchUsers: ({ sort, order }: { sort: string; order: string }) =>
    q<DB_Users & DB_Pagination>(
      "users.search",
      `SELECT 
      u.*,
      COUNT(*) OVER() as total_records
    FROM users u
    WHERE 
        ($1::text IS NULL OR $1::text = '' OR 
        LOWER(u.first_name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) OR 
        LOWER(u.last_name) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) OR
        LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')) OR
        LOWER(CONCAT(u.last_name, ' ', u.first_name)) LIKE LOWER(CONCAT('%', COALESCE($1::text, ''), '%')))
    AND
        ($2::text IS NULL OR $2::text = '' OR EXISTS (SELECT 1 FROM user_schools us WHERE us.user_id = u.id AND us.school_id::text = $2::text))
    AND
        ($3::text IS NULL OR $3::text = '' OR u.id::text != $3::text)
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

  searchListings: ({ sort, order }: { sort: string; order: string }) =>
    q<DB_Listings & DB_Pagination>(
      "listings.search",
      `SELECT
        l.*,
        COUNT(*) OVER() as total_records
    FROM listings l
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

  updateListingOfferedCreditsById: q<void>(
    "listing.updateOfferedCredits",
    `UPDATE listings SET offered_credits = $1 WHERE id = $2;`,
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
    `SELECT *, COUNT(*) OVER() AS total_records
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
  missionTemplateByKey: q<DB_MissionTemplates>(
    "missionsTemplates.byKey",
    `SELECT * FROM mission_templates WHERE key = $1`,
  ),
  userMissionsByUserIdAndTemplateId: q<DB_UserMissions>(
    "userMissions.byUserIdAndTemplateId",
    `SELECT * FROM user_missions WHERE user_id = $1 AND mission_template_id = $2`,
  ),
  progressMission: q<void>(
    "missions.progressMission",
    `UPDATE user_missions SET progress = $1, completed = $2, completed_at = NOW() WHERE id = $3`,
  ),
  assignMissionToUser: q<{ id: UUID }>(
    "missions.assignToUser",
    `INSERT INTO user_missions (user_id, mission_template_id, progress, completed) VALUES ($1, $2, $3, $4) RETURNING id`,
  ),
  allMissionTemplates: q<DB_MissionTemplates>(
    "missionsTemplates.all",
    `SELECT * FROM mission_templates`,
  ),
  adminByUsername: q<DB_Admin & { password: string }>(
    "admin.byUsername",
    `SELECT * FROM admins WHERE username = $1`,
  ),
  createAdmin: q<DB_Admin>(
    "admin.create",
    `INSERT INTO admins (username, full_name, password) VALUES ($1, $2, $3) RETURNING *`,
  ),
  createNotification: q<DB_Notifications>(
    "notifications.create",
    `INSERT INTO notifications (user_id, type, payload, is_read) VALUES ($1, $2, $3, FALSE) RETURNING *`,
  ),
  updateNotificationToken: q<void>(
    "notifications.updateToken",
    `UPDATE users SET notification_token = $1 WHERE id = $2`,
  ),
  // Admin queries
  adminSearchUsers: q<DB_Users & DB_Pagination>(
    "admin.searchUsers",
    `SELECT 
      u.*,
      COUNT(*) OVER() as total_records
    FROM users u
    WHERE LOWER(u.first_name || ' ' || u.last_name || ' ' || u.email) LIKE LOWER($1)
    ORDER BY u.created_at DESC
    LIMIT $2 OFFSET $3`,
  ),
  adminSearchUsersCount: q<{ total: number }>(
    "admin.searchUsersCount",
    `SELECT COUNT(*) as total
    FROM users u
    WHERE LOWER(u.first_name || ' ' || u.last_name || ' ' || u.email) LIKE LOWER($1)`,
  ),
  getAllUsersAdmin: q<DB_Users & DB_Pagination>(
    "admin.getAllUsers",
    `SELECT 
      u.*,
      COUNT(*) OVER() as total_records
    FROM users u
    ORDER BY u.created_at DESC`,
  ),
  getAllUsersAdminCount: q<{ total: number }>(
    "admin.getAllUsersCount",
    `SELECT COUNT(*) as total FROM users`,
  ),
  createWalletTransaction: q<DB_WalletTransactions>(
    "admin.createWalletTransaction",
    `INSERT INTO wallet_transactions (user_id, type, positive, amount, reference_id, meta)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
  ),
  increaseUserBalance: q<void>(
    "admin.increaseUserBalance",
    `UPDATE users SET credits_balance = credits_balance + $1 WHERE id = $2`,
  ),
  decreaseUserBalance: q<void>(
    "admin.decreaseUserBalance",
    `UPDATE users SET credits_balance = credits_balance - $1 WHERE id = $2`,
  ),
  createSchool: q<DB_Schools>(
    "admin.createSchool",
    `INSERT INTO schools (name, media_id) VALUES ($1, $2) RETURNING *`,
  ),
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
  getGlobalStats: q<DB_GlobalStats>(
    "admin.getGlobalStats",
    `SELECT * FROM global_stats`,
  ),
  getSchoolStats: q<DB_Schools>(
    "admin.getSchoolStats",
    `SELECT id, name, stat_kg_waste, stat_kg_co2, stat_l_h2o FROM schools ORDER BY name ASC`,
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
  getUserWhishesByUserId: q<DB_UsersWhishes>(
    "userWhishes.byUserId",
    `SELECT * FROM users_whishes WHERE user_id = $1`,
  ),
  addUserWhish: q<DB_UsersWhishes>(
    "userWhishes.add",
    `INSERT INTO users_whishes (user_id, category_id) VALUES ($1, $2) RETURNING *`,
  ),
  removeUserWhish: q<void>(
    "userWhishes.remove",
    `DELETE FROM users_whishes WHERE user_id = $1 AND category_id = $2`,
  ),
  updateUserWhishComment: q<void>(
    "userWhishes.updateComment",
    `UPDATE users_whishes SET comment = $1 WHERE user_id = $2 AND id = $3`,
  ),
  increaseUserStats: q<void>(
    "user.increaseStats",
    `UPDATE users SET stat_kg_waste = stat_kg_waste + $1, stat_kg_co2 = stat_kg_co2 + $2, stat_l_h2o = stat_l_h2o + $3 WHERE id = $4`,
  ),
  increaseSchoolStats: q<void>(
    "school.increaseStats",
    `UPDATE schools SET stat_kg_waste = stat_kg_waste + $1, stat_kg_co2 = stat_kg_co2 + $2, stat_l_h2o = stat_l_h2o + $3 WHERE id = $4`,
  ),
  increaseGlobalStats: q<void>(
    "global.increaseStats",
    `UPDATE global_stats 
    SET stat_value = stat_value + 
      CASE 
        WHEN stat_name = 'total_kg_waste' THEN $1
        WHEN stat_name = 'total_kg_co2' THEN $2
        WHEN stat_name = 'total_l_h2o' THEN $3
        ELSE 0
      END
    WHERE stat_name IN ('total_kg_waste', 'total_kg_co2', 'total_l_h2o')`,
  ),
} as const;
