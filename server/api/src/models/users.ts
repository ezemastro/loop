import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError, InvalidInputError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { getCategoryById, getUserById } from "../utils/helpersDb";
import {
  parsePagination,
  parseUserBaseFromDb,
  parseUserWishFromBase,
  parseUserWishFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { getOrderValue, getSortValue } from "../utils/sortOptions";

export class UsersModel {
  static getUsers = async (query: GetUsersRequest["query"]) => {
    const { page = 1, sort, order, searchTerm, schoolId, userId } = query || {};
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
        schoolId || null,
        userId || null,
        PAGE_SIZE,
        page ? (page - 1) * PAGE_SIZE : 0,
      ],
    );
    const totalRecords = safeNumber(usersSearchDb[0]?.total_records || 0);
    const users = await Promise.all(
      usersSearchDb.map(async (userSearchDb) => {
        return await getUserById({ client, userId: userSearchDb.id });
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

  static donate = async ({
    fromUserId,
    toUserId,
    amount,
  }: {
    fromUserId: string;
    toUserId: string;
    amount: number;
  }) => {
    // Obtener conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Verificar que no se está donando a uno mismo
      if (fromUserId === toUserId) {
        throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
      }
      // Verificar que el usuario al que se dona existe
      const [toUserDb] = await client.query(queries.userById, [toUserId]);
      if (!toUserDb) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const toUser = parseUserBaseFromDb(toUserDb);
      // Obtener el usuario que dona
      const [fromUserDb] = await client.query(queries.userById, [fromUserId]);
      if (!fromUserDb) {
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const fromUser = parseUserBaseFromDb(fromUserDb);
      // Verificar que el usuario que dona tiene saldo suficiente
      if (fromUser.credits.balance < amount) {
        throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
      }
      // Realizar la donación en una transacción
      await client.begin();
      await client.query(queries.updateUserBalance, [
        fromUser.credits.balance - amount,
        fromUser.credits.locked,
        fromUserId,
      ]);
      await client.query(queries.updateUserBalance, [
        toUser.credits.balance + amount,
        toUser.credits.locked,
        toUserId,
      ]);
      await client.commit();
    } catch (err) {
      await client.rollback();
      throw err;
    } finally {
      client.release();
    }
  };

  static getUserWishes = async ({ userId }: { userId: string }) => {
    // Obtener conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const userWishesDb = await client.query(queries.getUserWishesByUserId, [
        userId,
      ]);
      const userWishes = await Promise.all(
        userWishesDb.map(async (wishDb) => {
          const wishBase = parseUserWishFromDb(wishDb);
          return parseUserWishFromBase({
            userWish: wishBase,
            category: await getCategoryById({
              client,
              categoryId: wishDb.category_id,
            }),
          });
        }),
      );
      return { userWishes };
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    } finally {
      client.release();
    }
  };
}
