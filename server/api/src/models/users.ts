import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { getMediaById, getRoleById, getSchoolById } from "../utils/helpersDb";
import {
  parsePagination,
  parsePublicUserFromBase,
  parseUserBaseFromDb,
} from "../utils/parseDb";

export class UsersModel {
  static getUsers = async (query: GetUsersRequest["query"]) => {
    const {
      page = 1,
      sort = "created_at",
      order = "desc",
      searchTerm,
      roleId,
      schoolId,
    } = query || {};
    // Obtener conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    const usersSearchDb = await client.query(queries.searchUsers, [
      searchTerm || null,
      roleId || null,
      schoolId || null,
      sort,
      order,
      PAGE_SIZE,
      page,
    ]);
    const totalRecords = usersSearchDb[0]?.total_records || 0;
    const users = await Promise.all(
      usersSearchDb.map(async (userSearchDb) => {
        return parsePublicUserFromBase({
          profileMedia: userSearchDb.profile_media_id
            ? await getMediaById({
                client,
                mediaId: userSearchDb.profile_media_id,
              })
            : null,
          role: await getRoleById({ client, roleId: userSearchDb.role_id }),
          school: await getSchoolById({
            client,
            schoolId: userSearchDb.school_id,
          }),
          user: parseUserBaseFromDb(userSearchDb),
        });
      }),
    );
    return {
      users,
      pagination: parsePagination({
        currentPage: page,
        totalRecords,
      }),
    };
  };
}
