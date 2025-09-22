import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError, InvalidInputError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import {
  getMediaById,
  getRoleById,
  getSchoolById,
  getUserById,
} from "../utils/helpersDb";
import {
  parsePagination,
  parsePublicUserFromBase,
  parseUserBaseFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { getOrderValue, getSortValue } from "../utils/sortOptions";

export class UsersModel {
  static getUsers = async (query: GetUsersRequest["query"]) => {
    const {
      page = 1,
      sort = "created_at",
      order = "desc",
      searchTerm,
      roleId,
      schoolId,
      userId,
    } = query || {};
    // Obtener conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    const dbSort = getSortValue(sort);
    const dbOrder = getOrderValue(order);
    const usersSearchDb = await client.query(
      queries.searchUsers({ sort: dbSort, order: dbOrder }),
      [
        searchTerm || null,
        roleId || null,
        schoolId || null,
        userId || null,
        PAGE_SIZE,
        page ? (page - 1) * PAGE_SIZE : 0,
      ],
    );
    const totalRecords = safeNumber(usersSearchDb[0]?.total_records || 0);
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
        totalRecords: totalRecords || 0,
      }),
    };
  };

  static getUserById = async ({ userId }: { userId: string }) => {
    // Obtener conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      let user: PublicUser;
      try {
        user = await getUserById({ client, userId });
      } catch {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      return { user };
    } finally {
      client.release();
    }
  };
}
