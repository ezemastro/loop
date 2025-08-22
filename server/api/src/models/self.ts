import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import {
  parseMediaFromDb,
  parsePrivateUserFromBase,
  parseRoleFromDb,
  parseSchoolFromBase,
  parseSchoolFromDb,
  parseUserFromDb,
} from "../utils/parseDb";

export class SelfModel {
  static getSelf = async ({ userId }: { userId: string }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener usuario
      let userDb: DB_Users | undefined;
      try {
        [userDb] = await client.query(queries.userById, [userId]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!userDb) {
        throw new InternalServerError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      // Obtener rol y colegio
      let roleDb: DB_Roles | undefined;
      let schoolDb: DB_Schools | undefined;
      let userMediaDb: DB_Media | undefined;
      try {
        [[schoolDb], [roleDb], [userMediaDb]] = await Promise.all([
          client.query(queries.schoolById, [userDb.school_id]),
          client.query(queries.roleById, [userDb.role_id]),
          client.query(queries.mediaById, [userDb.profile_media_id]),
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!roleDb) throw new InternalServerError(ERROR_MESSAGES.ROLE_NOT_FOUND);
      if (!schoolDb)
        throw new InternalServerError(ERROR_MESSAGES.SCHOOL_NOT_FOUND);
      // Obtener medios de la escuela
      let schoolMediaDb: DB_Media | undefined;
      try {
        [schoolMediaDb] = await client.query(queries.mediaById, [
          schoolDb.media_id,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!schoolMediaDb)
        throw new InternalServerError(ERROR_MESSAGES.MEDIA_NOT_FOUND);

      // Devolver datos
      return {
        user: parsePrivateUserFromBase({
          user: parseUserFromDb(userDb),
          role: parseRoleFromDb(roleDb),
          school: parseSchoolFromBase({
            school: parseSchoolFromDb(schoolDb),
            media: parseMediaFromDb(schoolMediaDb),
          }),
          profileMedia: userMediaDb ? parseMediaFromDb(userMediaDb) : null,
        }),
      };
    } finally {
      client.release();
    }
  };
}
