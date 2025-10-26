import { ERROR_MESSAGES, MISSION_KEYS, PAGE_SIZE } from "../config";
import { InternalServerError, UnauthorizedError } from "../services/errors";
import { hashPassword } from "../services/hash";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import {
  safeValidateEmail,
  safeValidateFirstName,
  safeValidateLastName,
  safeValidatePassword,
  safeValidatePhone,
  safeValidateUUID,
} from "../services/validations";
import type { DatabaseClient } from "../types/dbClient";
import {
  getUserMissionsByUserId,
  getNotificationsByUserId,
  getUserById,
  getCategoryById,
  getMediasByListingId,
  getMessageById,
  progressMission,
  getPrivateUserById,
} from "../utils/helpersDb";
import {
  parseChatFromDb,
  parseListingBaseFromDb,
  parseListingFromBase,
  parsePagination,
  parseUserBaseFromDb,
  parseUserWhishFromBase,
  parseUserWhishFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { getOrderValue, getSortValue } from "../utils/sortOptions";

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
      // Devolver usuario con todas sus escuelas
      const user = await getPrivateUserById({ client, userId });
      return { user };
    } finally {
      client.release();
    }
  };

  static updateSelf = async ({
    userId,
    email,
    firstName,
    lastName,
    phone,
    profileMediaId,
    password,
    schoolIds,
  }: {
    userId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    profileMediaId?: string | null;
    password?: string;
    schoolIds?: string[];
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      await client.begin();
      // Obtener usuario
      let user: UserBase & { password: string };
      try {
        const [userDb] = await client.query(queries.userById, [userId]);
        if (!userDb) {
          throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        user = { ...parseUserBaseFromDb(userDb), password: userDb.password };
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Misión - Actualizar foto de perfil
      if (profileMediaId && profileMediaId !== user.profileMediaId) {
        // TODO - Manejar error si falla la misión
        await progressMission({
          client,
          userId,
          missionKey: MISSION_KEYS.UPDATE_PROFILE_IMAGE,
        });
      }
      // Preparar datos para actualizar usuario
      email =
        email && (await safeValidateEmail(email)).success ? email : user.email;
      firstName =
        firstName && (await safeValidateFirstName(firstName)).success
          ? firstName
          : user.firstName;
      lastName =
        lastName && (await safeValidateLastName(lastName)).success
          ? lastName
          : user.lastName;
      phone =
        phone && (await safeValidatePhone(phone)).success ? phone : user.phone;
      profileMediaId =
        profileMediaId && (await safeValidateUUID(profileMediaId)).success
          ? profileMediaId
          : user.profileMediaId;
      password =
        password && (await safeValidatePassword(password))
          ? await hashPassword(password)
          : user.password;

      // Actualizar usuario
      try {
        await client.query(queries.updateUser, [
          email,
          firstName,
          lastName,
          phone,
          profileMediaId,
          password,
          userId,
        ]);
        // Si se envían schoolIds, actualizar las escuelas del usuario
        if (schoolIds) {
          await client.query(queries.deleteUserSchools, [userId]);
          if (schoolIds.length > 0) {
            await client.query(queries.insertUserSchools(schoolIds.length), [
              userId,
              ...schoolIds,
            ]);
          }
        }
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      await client.commit();
      // Devolver usuario actualizado
      const updatedUser = await getPrivateUserById({ client, userId });
      return { user: updatedUser };
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  };

  static getSelfListings = async ({
    userId,
    sellerId,
    buyerId,
    searchTerm,
    categoryId,
    productStatus,
    listingStatus,
    page,
    sort,
    order,
  }: {
    userId: string;
    sellerId?: string;
    buyerId?: string;
    searchTerm?: string;
    categoryId?: string;
    productStatus?: ProductStatus;
    listingStatus?: ListingStatus;
    page?: number;
    sort?: SortOptions;
    order?: "asc" | "desc";
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener publicaciones del usuario
      const sortValue = getSortValue(sort);
      const orderValue = getOrderValue(order);
      const listingsDb = await client.query(
        queries.listings({ sort: sortValue, order: orderValue }),
        [
          searchTerm ?? null,
          listingStatus ?? null,
          categoryId ?? null,
          productStatus ?? null,
          sellerId ?? null,
          buyerId ?? null,
          userId,
          PAGE_SIZE,
          PAGE_SIZE * ((page ?? 1) - 1),
        ],
      );
      const listings = await Promise.all(
        listingsDb.map(async (listingDb) => {
          return parseListingFromBase({
            listing: parseListingBaseFromDb(listingDb),
            buyer: listingDb.buyer_id
              ? await getUserById({
                  client,
                  userId: listingDb.buyer_id,
                })
              : null,
            seller: await getUserById({ client, userId: listingDb.seller_id }),
            category: await getCategoryById({
              client,
              categoryId: listingDb.category_id,
            }),
            media: await getMediasByListingId({
              client,
              listingId: listingDb.id,
            }),
          });
        }),
      );
      const pagination = parsePagination({
        currentPage: page ?? 1,
        totalRecords: safeNumber(listingsDb[0]?.total_records) ?? 0,
      });
      return { listings, pagination };
    } finally {
      client.release();
    }
  };

  static getSelfMissions = async ({ userId }: { userId: string }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener misiones del usuario
      const missions = await getUserMissionsByUserId({ client, userId });
      // Devolver filtrando las inactivas
      return {
        missions: missions.filter((mission) => mission.missionTemplate.active),
      };
    } finally {
      client.release();
    }
  };

  static getSelfNotifications = async ({
    userId,
    page,
  }: {
    userId: string;
    page: number | undefined;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener notificaciones del usuario
      const { notifications, pagination } = await getNotificationsByUserId({
        client,
        userId,
        page,
      });

      return { notifications, pagination };
    } finally {
      client.release();
    }
  };

  static getSelfUnreadNotificationsCount = async ({
    userId,
  }: {
    userId: UUID;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener cuantas notificaciones no leídas tiene el usuario
      const result = await client.query(
        queries.unreadNotificationsCountByUserId,
        [userId],
      );
      const unreadNotificationsCount = result[0]?.unread_count ?? 0;
      return { unreadNotificationsCount };
    } finally {
      client.release();
    }
  };

  static setAllSelfNotificationsRead = async ({ userId }: { userId: UUID }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Marcar todas las notificaciones como leídas
      await client.query(queries.markNotificationsAsRead, [userId]);
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
    } finally {
      client.release();
    }
  };

  static getSelfChats = async ({
    userId,
    page,
  }: {
    userId: string;
    page: number | undefined;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener chats del usuario
      const chatsDb = await client.query(queries.chatsByUserId, [
        userId,
        PAGE_SIZE,
        PAGE_SIZE * ((page ?? 1) - 1),
      ]);
      const chatsBase = chatsDb.map(parseChatFromDb);
      const chats = await Promise.all(
        chatsBase.map(async (chat) => {
          return {
            ...chat,
            lastMessage: await getMessageById({
              client,
              messageId: chat.lastMessageId,
            }),
            user: await getUserById({ client, userId: chat.userId }),
          };
        }),
      );
      const pagination = parsePagination({
        currentPage: page ?? 1,
        totalRecords: safeNumber(chatsDb[0]?.total_records) || 0,
      });
      return { chats, pagination };
    } finally {
      client.release();
    }
  };

  static getSelfUnreadChatsCount = async ({ userId }: { userId: string }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener cuantos chats tiene con mensajes no leídos
      let unreadChatsCount: number;
      try {
        const result = await client.query(queries.unreadChatsCountByUserId, [
          userId,
        ]);
        unreadChatsCount = safeNumber(result[0]?.unread_count) ?? 0;
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      return { unreadChatsCount };
    } finally {
      client.release();
    }
  };
  static updateNotificationToken = async ({
    userId,
    notificationToken,
  }: {
    userId: string;
    notificationToken: string | null;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Actualizar token de notificaciones push del usuario
      try {
        await client.query(queries.updateNotificationToken, [
          notificationToken,
          userId,
        ]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
    } finally {
      client.release();
    }
  };

  static getSelfWhishes = async ({ userId }: { userId: UUID }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener deseos del usuario
      const whishesDb = await client.query(queries.getUserWhishesByUserId, [
        userId,
      ]);
      const userWhishesBase = whishesDb.map(parseUserWhishFromDb);
      const userWhishes = await Promise.all(
        userWhishesBase.map(async (userWhishBase) => {
          return parseUserWhishFromBase({
            userWhish: userWhishBase,
            category: await getCategoryById({
              client,
              categoryId: userWhishBase.categoryId,
            }),
          });
        }),
      );
      return { userWhishes };
    } finally {
      client.release();
    }
  };

  static addSelfWhish = async ({
    userId,
    categoryId,
  }: {
    userId: UUID;
    categoryId: UUID;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Agregar deseo del usuario
      const result = await client.query(queries.addUserWhish, [
        userId,
        categoryId,
      ]);
      const userWhishBase = parseUserWhishFromDb(result[0]!);
      const userWhish = parseUserWhishFromBase({
        userWhish: userWhishBase,
        category: await getCategoryById({
          client,
          categoryId: userWhishBase.categoryId,
        }),
      });
      return { userWhish };
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
    } finally {
      client.release();
    }
  };

  static deleteSelfWhish = async ({
    userId,
    categoryId,
  }: {
    userId: UUID;
    categoryId: UUID;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Eliminar deseo del usuario
      await client.query(queries.removeUserWhish, [userId, categoryId]);
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
    } finally {
      client.release();
    }
  };

  static modifyWhishComment = async ({
    userId,
    whishId,
    comment,
  }: {
    userId: UUID;
    whishId: UUID;
    comment: string | null;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Actualizar comentario del deseo del usuario
      await client.query(queries.updateUserWhishComment, [
        comment,
        userId,
        whishId,
      ]);
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
    } finally {
      client.release();
    }
  };
}
