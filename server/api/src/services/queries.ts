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

  missionTemplateById: q<DB_MissionTemplates>(
    "missions.templateById",
    `SELECT * FROM template_missions WHERE id = $1`,
  ),
} as const;
