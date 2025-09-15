import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError, UnauthorizedError } from "../services/errors";
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
  getChatsByUserId,
  getMediaById,
  getRoleById,
  getSchoolById,
  getUserById,
  getCategoryById,
  getMediasByListingId,
} from "../utils/helpersDb";
import {
  parseListingBaseFromDb,
  parseListingFromBase,
  parseMediaFromDb,
  parsePagination,
  parsePrivateUserFromBase,
  parseRoleFromDb,
  parseSchoolFromBase,
  parseSchoolFromDb,
  parseUserBaseFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";

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
          userDb.profile_media_id
            ? client.query(queries.mediaById, [userDb.profile_media_id])
            : Promise.resolve([undefined]),
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
          user: parseUserBaseFromDb(userDb),
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

  static updateSelf = async ({
    userId,
    email,
    firstName,
    lastName,
    phone,
    profileMediaId,
    password,
  }: {
    userId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    profileMediaId?: string | null;
    password?: string;
  }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
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
          ? password
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
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      // Devolver usuario base actualizado
      return {
        user: parsePrivateUserFromBase({
          user: {
            id: userId,
            email,
            firstName,
            lastName,
            phone,
            profileMediaId,
            roleId: user.roleId,
            schoolId: user.schoolId,
            credits: user.credits,
          },
          profileMedia: profileMediaId
            ? await getMediaById({ client, mediaId: profileMediaId })
            : null,
          role: await getRoleById({ client, roleId: user.roleId }),
          school: await getSchoolById({ client, schoolId: user.schoolId }),
        }),
      };
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
    sort?: string;
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
      const listingsDb = await client.query(queries.listings, [
        searchTerm ?? null,
        listingStatus ?? null,
        categoryId ?? null,
        productStatus ?? null,
        sellerId ?? null,
        buyerId ?? null,
        userId,
        order ?? "desc",
        sort ?? "created_at",
        PAGE_SIZE,
        PAGE_SIZE * ((page ?? 1) - 1),
      ]);
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

  static getSelfNotifications = async ({ userId }: { userId: string }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener notificaciones del usuario
      const notifications = await getNotificationsByUserId({ client, userId });

      return { notifications };
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

  static getSelfChats = async ({ userId }: { userId: string }) => {
    // Crear conexión a la base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener chats del usuario
      const chats = await getChatsByUserId({ client, userId });
      return { chats };
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
}
