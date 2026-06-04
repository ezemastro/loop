import { ERROR_MESSAGES, MISSION_KEYS, PAGE_SIZE } from "../config";
import { InternalServerError, InvalidInputError, UnauthorizedError } from "../services/errors";
import { comparePasswords, hashPassword } from "../services/hash";
import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import {
  safeValidateEmail,
  safeValidateFirstName,
  safeValidateLastName,
  safeValidatePassword,
  safeValidatePhone,
  safeValidateUUID,
} from "../services/validations";
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
  parseUserWishFromBase,
  parseUserWishFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { getOrderValue, getSortValue } from "../utils/sortOptions";

export class SelfModel {
  static getSelf = async ({ userId }: { userId: string }) => {
    return withClient(async (client) => {
      const user = await getPrivateUserById({ client, userId });
      return { user };
    });
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
    return withClient(async (client) => {
      let user: UserBase & { password: string | null };
      try {
        const [userDb] = await client.query(queries.userById, [userId]);
        if (!userDb) {
          throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        user = { ...parseUserBaseFromDb(userDb), password: userDb.password };
      } catch (e) {
        if (e instanceof UnauthorizedError) throw e;
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      if (profileMediaId && profileMediaId !== (user.profileMediaId ?? null)) {
        await progressMission({
          client,
          userId,
          missionKey: MISSION_KEYS.UPDATE_PROFILE_IMAGE,
        });
      }

      email = email && (await safeValidateEmail(email)).success ? email : user.email;
      firstName =
        firstName && (await safeValidateFirstName(firstName)).success ? firstName : user.firstName;
      lastName =
        lastName && (await safeValidateLastName(lastName)).success ? lastName : user.lastName;
      phone = phone && (await safeValidatePhone(phone)).success ? phone : user.phone;
      profileMediaId =
        profileMediaId && (await safeValidateUUID(profileMediaId)).success
          ? profileMediaId
          : user.profileMediaId;
      password =
        password && (await safeValidatePassword(password))
          ? await hashPassword(password)
          : (user.password ?? undefined);

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
        if (schoolIds) {
          await client.query(queries.deleteUserSchools, [userId]);
          if (schoolIds.length > 0) {
            await client.query(queries.insertUserSchools(schoolIds.length), [userId, ...schoolIds]);
          }
        }
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }

      const updatedUser = await getPrivateUserById({ client, userId });
      return { user: updatedUser };
    }, { transaction: true });
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
    return withClient(async (client) => {
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
    });
  };

  static getSelfMissions = async ({ userId }: { userId: string }) => {
    return withClient(async (client) => {
      const missions = await getUserMissionsByUserId({ client, userId });
      return {
        missions: missions.filter((mission) => mission.missionTemplate.active),
      };
    });
  };

  static getSelfNotifications = async ({
    userId,
    page,
  }: {
    userId: string;
    page: number | undefined;
  }) => {
    return withClient(async (client) => {
      const { notifications, pagination } = await getNotificationsByUserId({
        client,
        userId,
        page,
      });
      return { notifications, pagination };
    });
  };

  static getSelfUnreadNotificationsCount = async ({ userId }: { userId: UUID }) => {
    return withClient(async (client) => {
      const result = await client.query(queries.unreadNotificationsCountByUserId, [userId]);
      const unreadNotificationsCount = result[0]?.unread_count ?? 0;
      return { unreadNotificationsCount };
    });
  };

  static setAllSelfNotificationsRead = async ({ userId }: { userId: UUID }) => {
    return withClient(async (client) => {
      await client.query(queries.markNotificationsAsRead, [userId]);
    });
  };

  static getSelfChats = async ({ userId, page }: { userId: string; page: number | undefined }) => {
    return withClient(async (client) => {
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
    });
  };

  static getSelfUnreadChatsCount = async ({ userId }: { userId: string }) => {
    return withClient(async (client) => {
      const result = await client.query(queries.unreadChatsCountByUserId, [userId]);
      const unreadChatsCount = safeNumber(result[0]?.unread_count) ?? 0;
      return { unreadChatsCount };
    });
  };

  static updateNotificationToken = async ({
    userId,
    notificationToken,
  }: {
    userId: string;
    notificationToken: string | null;
  }) => {
    return withClient(async (client) => {
      await client.query(queries.updateNotificationToken, [notificationToken, userId]);
    });
  };

  static getSelfWishes = async ({ userId }: { userId: UUID }) => {
    return withClient(async (client) => {
      const wishesDb = await client.query(queries.getUserWishesByUserId, [userId]);
      const userWishesBase = wishesDb.map(parseUserWishFromDb);
      const userWishes = await Promise.all(
        userWishesBase.map(async (userWishBase) => {
          return parseUserWishFromBase({
            userWish: userWishBase,
            category: await getCategoryById({
              client,
              categoryId: userWishBase.categoryId,
            }),
          });
        }),
      );
      return { userWishes };
    });
  };

  static createSelfWish = async ({
    userId,
    categoryId,
    comment,
  }: {
    userId: UUID;
    categoryId: UUID;
    comment?: string | null;
  }) => {
    return withClient(async (client) => {
      const result = await client.query(queries.createUserWish, [userId, categoryId, comment]);
      const userWishBase = parseUserWishFromDb(result[0]!);
      const userWish = parseUserWishFromBase({
        userWish: userWishBase,
        category: await getCategoryById({
          client,
          categoryId: userWishBase.categoryId,
        }),
      });
      return { userWish };
    });
  };

  static deleteSelfWish = async ({ userId, categoryId }: { userId: UUID; categoryId: UUID }) => {
    return withClient(async (client) => {
      await client.query(queries.removeUserWish, [userId, categoryId]);
    });
  };

  static modifyWish = async ({
    userId,
    wishId,
    comment,
    categoryId,
  }: {
    userId: UUID;
    wishId: UUID;
    comment?: string | null;
    categoryId?: UUID;
  }) => {
    return withClient(async (client) => {
      let wishDb: DB_UsersWishes | undefined;
      try {
        [wishDb] = await client.query(queries.userWishById, [wishId]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!wishDb) {
        throw new InvalidInputError(ERROR_MESSAGES.WISH_NOT_FOUND);
      }
      const wishBase = parseUserWishFromDb(wishDb);
      if (wishBase.userId !== userId) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_AUTHORIZED);
      }
      const newWish: UserWishBase = {
        id: wishBase.id,
        userId: wishBase.userId,
        categoryId: categoryId || wishBase.categoryId,
        comment: comment !== undefined ? comment : wishBase.comment,
      };
      try {
        await client.query(queries.updateUserWish, [newWish.comment, newWish.categoryId, wishId]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      return {
        userWish: parseUserWishFromBase({
          userWish: newWish,
          category: await getCategoryById({
            client,
            categoryId: newWish.categoryId,
          }),
        }),
      };
    });
  };

  static modifyUserPassword = async ({
    userId,
    newPassword,
    oldPassword,
  }: {
    userId: UUID;
    newPassword: string;
    oldPassword: string;
  }) => {
    return withClient(async (client) => {
      let userDb: DB_Users | undefined;
      try {
        [userDb] = await client.query(queries.userById, [userId]);
      } catch {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
      }
      if (!userDb) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      const currentPasswordHash = userDb.password;
      if (!currentPasswordHash) {
        throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      const isPasswordCorrect = await comparePasswords(oldPassword, currentPasswordHash);
      if (!isPasswordCorrect) {
        throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }
      const hashedPassword = await hashPassword(newPassword);
      await client.query(queries.updateUserPassword, [hashedPassword, userId]);
    });
  };

  static deleteSelf = async ({ userId }: { userId: UUID }) => {
    return withClient(async (client) => {
      const sellerListingIds = await client.query(queries.listingIdsBySellerId, [userId]);
      const ids = sellerListingIds.map((row) => row.id);

      if (ids.length > 0) {
        await client.query(queries.setMessagesAttachedListingNullBySellerId, [userId]);
        await client.query(queries.deleteListingTradesByListingIds(ids), [ids]);
      }

      await client.query(queries.deleteListingsBySellerId, [userId]);
      await client.query(queries.updateListingsBuyerToNullByUserId, [userId]);
      await client.query(queries.deleteMessagesByUserId, [userId]);
      await client.query(queries.deleteNotificationsByUserId, [userId]);
      await client.query(queries.deleteUserMissionsByUserId, [userId]);
      await client.query(queries.deleteWalletTransactionsByUserId, [userId]);
      await client.query(queries.deleteUserSchoolsByUserId, [userId]);
      await client.query(queries.deleteUserWishesByUserId, [userId]);
      await client.query(queries.updateMediaUploadedByToNullByUserId, [userId]);
      await client.query(queries.deleteUserById, [userId]);
    }, { transaction: true });
  };

  static deleteSelfByEmail = async ({ email }: { email: string }) => {
    return withClient(async (client) => {
      const [userDb] = await client.query(queries.userByEmailCaseInsensitive, [email]);
      if (!userDb) {
        throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const sellerListingIds = await client.query(queries.listingIdsBySellerId, [
        userDb.id,
      ]);
      const ids = sellerListingIds.map((row) => row.id);

      if (ids.length > 0) {
        await client.query(queries.setMessagesAttachedListingNullBySellerId, [userDb.id]);
        await client.query(queries.deleteListingTradesByListingIds(ids), [ids]);
      }

      await client.query(queries.deleteListingsBySellerId, [userDb.id]);
      await client.query(queries.updateListingsBuyerToNullByUserId, [userDb.id]);
      await client.query(queries.deleteMessagesByUserId, [userDb.id]);
      await client.query(queries.deleteNotificationsByUserId, [userDb.id]);
      await client.query(queries.deleteUserMissionsByUserId, [userDb.id]);
      await client.query(queries.deleteWalletTransactionsByUserId, [userDb.id]);
      await client.query(queries.deleteUserSchoolsByUserId, [userDb.id]);
      await client.query(queries.deleteUserWishesByUserId, [userDb.id]);
      await client.query(queries.updateMediaUploadedByToNullByUserId, [userDb.id]);
      await client.query(queries.deleteUserById, [userDb.id]);
    }, { transaction: true });
  };
}
