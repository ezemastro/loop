import type { NamedQuery } from "../types/dbClient.js";

// Helper para crear queries nombradas
const q = <T>(key: string, text: string): NamedQuery<T> => ({
  key,
  text,
});

export const queries = {
  userExists: q<{ exists: boolean }>(
    "user.exists",
    `SELECT EXISTS(
       SELECT 1 FROM users WHERE email = $1 AND first_name = $2 AND last_name = $3
     ) AS exists`,
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
    `SELECT * FROM missions WHERE user_id = $1`,
  ),

  userMissionsById: q<DB_UserMissions>(
    "missions.byId",
    `SELECT * FROM missions WHERE id = $1`,
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

  mediasByListingId: q<DB_Media>(
    "listings.mediasById",
    `SELECT * FROM media WHERE listing_id = $1`,
  ),

  categoryById: q<DB_Categories>(
    "categories.byId",
    `SELECT * FROM categories WHERE id = $1`,
  ),

  categoriesByParentId: q<DB_Categories>(
    "categories.byParentId",
    `SELECT * FROM categories WHERE parent_id = $1`,
  ),

  markNotificationsAsRead: q<DB_Notifications>(
    "notifications.markAsRead",
    `UPDATE notifications SET read = TRUE WHERE user_id = $1`,
  ),

  chatsByUserId: q<{
    other_user_id: UUID;
    last_message_id: UUID;
    unread_count: number;
  }>(
    "chats.byUserId",
    `SELECT 
      other_user_id,
      last_message_id,
      unread_count
    FROM (
      SELECT 
          CASE 
              WHEN m.sender_id = $1 THEN m.recipient_id 
              ELSE m.sender_id 
          END as other_user_id,
          MAX(m.id) as last_message_id,
          COUNT(CASE WHEN m.sender_id != $1 AND m.is_read = false THEN 1 END) as unread_count
      FROM 
          db_messages m
      WHERE 
          m.sender_id = $1 OR m.recipient_id = $1
      GROUP BY 
          CASE 
              WHEN m.sender_id = $1 THEN m.recipient_id 
              ELSE m.sender_id 
          END
    )`,
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
        ($1 IS NULL OR $1 = '' OR 
        LOWER(first_name) LIKE LOWER('%' || $1 || '%') OR 
        LOWER(last_name) LIKE LOWER('%' || $1 || '%'))
    AND
        ($2 IS NULL OR $2 = '' OR role_id::text = $2)
    AND
        ($3 IS NULL OR $3 = '' OR school_id::text = $3)
    ORDER BY 
        CASE 
            WHEN $4 = 'id' THEN id::text
            WHEN $4 = 'first_name' THEN first_name
            WHEN $4 = 'last_name' THEN last_name
            WHEN $4 = 'email' THEN email
            WHEN $4 = 'school_id' THEN school_id::text
            WHEN $4 = 'role_id' THEN role_id::text
            WHEN $4 = 'created_at' THEN created_at::text
            WHEN $4 = 'credits_balance' THEN credits_balance::text
            ELSE created_at::text
        END
        CASE WHEN $5 = 'desc' THEN DESC ELSE ASC END
    LIMIT $6 OFFSET (($7 - 1) * $6);`,
  ),
} as const;
