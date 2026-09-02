import { ERROR_MESSAGES, MISSION_KEYS, PAGE_SIZE } from "../config";
import { InternalServerError, InvalidInputError, UnauthorizedError } from "../services/errors";
import { comparePasswords, hashPassword } from "../services/hash";
import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import {
  safeValidateFirstName,
  safeValidateLastName,
  safeValidatePhone,
  safeValidateUUID,
} from "../services/validations";
import type {
  AcceptTermsPayload,
  CreateSelfWishPayload,
  DeleteSelfPayload,
  DeleteSelfWishPayload,
  GetSelfListingsPayload,
  GetSelfPaginatedPayload,
  GetSelfPayload,
  ModifySelfWishPayload,
  ModifyUserPasswordPayload,
  UpdateNotificationTokenPayload,
  UpdateSelfPayload,
  UserScopedPayload,
} from "../types/models";
import type { DatabaseClient } from "../types/dbClient.js";
import { areSchoolsInCommunity } from "../utils/communities.js";
import type { CreditMovement } from "../utils/credits.js";
import { applyCreditMovements } from "../utils/credits.js";
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
import { computeLoopEscrow } from "../utils/loopEscrow.js";
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
import { escapeLike } from "../utils/escapeLike";

/**
 * El cuerpo real del borrado, factorizado fuera de `SelfModel.deleteSelf` para que
 * `AccountDeletionModel.resolveRequest` (borrado disparado por un admin) pueda correrlo dentro de
 * SU PROPIA transacción `unscoped("admin")` en vez de abrir una segunda conexión aparte
 * (account-deletion-integrity: "Deletion Is One Transaction") — antes esa ruta marcaba la
 * solicitud como `completed` y recién después intentaba borrar en un `withClient` distinto, así
 * que una falla en el borrado dejaba la solicitud mintiendo.
 *
 * Nunca abre conexión propia: recibe el `client` ya scopeado (`inCommunity` para el propio
 * usuario, `unscoped("admin")` para el admin) y confía en que el caller ya está dentro de una
 * transacción.
 *
 * account-deletion-integrity: "Third-Party Credits Are Released" — antes de tocar una sola fila,
 * se liberan los créditos de la contraparte de cada loop abierto en el que el usuario participa,
 * como vendedor o como comprador, igual que una cancelación (`ListingsModel.cancelListing`,
 * `computeLoopEscrow`). Sin esto, borrar la cuenta de un vendedor dejaba el crédito bloqueado del
 * comprador varado contra una publicación que dejaba de existir.
 */
export const performAccountDeletion = async ({
  client,
  userId,
}: {
  client: DatabaseClient;
  userId: UUID;
}): Promise<void> => {
  const openAsSeller = await client.query(queries.listingsBySellerIdOpen, [
    userId,
    client.communityId,
  ]);
  const openAsBuyer = await client.query(queries.listingsByBuyerIdOpen, [
    userId,
    client.communityId,
  ]);

  const releaseMovements: CreditMovement[] = [];
  for (const listingDb of openAsSeller) {
    const buyerLocked = listingDb.offered_credits !== null ? Number(listingDb.offered_credits) : 0;
    if (buyerLocked > 0 && listingDb.buyer_id) {
      releaseMovements.push({
        userId: listingDb.buyer_id,
        balanceDelta: buyerLocked,
        lockedDelta: -buyerLocked,
        reason: "deletion_release",
        referenceId: listingDb.id,
      });
    }
  }
  for (const listingDb of openAsBuyer) {
    // Solo un loop `accepted` puede tener trade-in de sobra bloqueado del lado del vendedor
    // (`accept_seller_lock`); uno `offered` nunca tiene `listing_trades` todavía.
    if (listingDb.listing_status === "accepted") {
      const { sellerLocked } = await computeLoopEscrow({ client, listing: listingDb });
      if (sellerLocked > 0) {
        releaseMovements.push({
          userId: listingDb.seller_id,
          balanceDelta: sellerLocked,
          lockedDelta: -sellerLocked,
          reason: "deletion_release",
          referenceId: listingDb.id,
        });
      }
    }
  }
  if (releaseMovements.length > 0) {
    await applyCreditMovements(client, releaseMovements);
  }

  const sellerListingIds = await client.query(queries.listingIdsBySellerId, [
    userId,
    client.communityId,
  ]);
  const ids = sellerListingIds.map((row) => row.id);

  if (ids.length > 0) {
    await client.query(queries.setMessagesAttachedListingNullBySellerId, [
      userId,
      client.communityId,
    ]);
    await client.query(queries.deleteListingTradesByListingIds(ids), [ids, client.communityId]);
  }

  await client.query(queries.deleteListingsBySellerId, [userId, client.communityId]);
  // `AND listing_status IN ('offered','accepted')` (account-deletion-integrity: "A settled loop
  // is not reopened") ya vive en la query — un loop `received` no vuelve a `published`.
  await client.query(queries.updateListingsBuyerToNullByUserId, [userId, client.communityId]);
  await client.query(queries.deleteMessagesByUserId, [userId, client.communityId]);
  await client.query(queries.deleteNotificationsByUserId, [userId, client.communityId]);
  await client.query(queries.deleteUserMissionsByUserId, [userId, client.communityId]);
  // `deleteWalletTransactionsByUserId` ya NO se llama (account-deletion-integrity: "The Ledger
  // Survives Deletion") — la FK de `wallet_transactions` es `ON DELETE SET NULL (user_id)` desde
  // la migración `0014`, así que `deleteUserById` anonimiza esas filas en vez de destruirlas.
  await client.query(queries.deleteUserSchoolsByUserId, [userId, client.communityId]);
  await client.query(queries.deleteUserWishesByUserId, [userId, client.communityId]);
  await client.query(queries.updateMediaUploadedByToNullByUserId, [userId, client.communityId]);
  // Estas dos tablas no llevan community_id en el filtro y apuntan al usuario por FK: si no se
  // limpian antes, `deleteUserById` falla por `invitations.used_by_user_id` y por
  // `account_deletion_requests.user_id`.
  await client.query(queries.clearInvitationUserByUserId, [userId]);
  await client.query(queries.deleteAccountDeletionRequestsByUserId, [userId]);
  await client.query(queries.deleteUserById, [userId, client.communityId]);
};

export class SelfModel {
  static getSelf = async ({ userId, communityId }: GetSelfPayload) => {
    return withClient(
      async (client) => {
        const user = await getPrivateUserById({ client, userId });
        return { user };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static updateSelf = async ({
    userId,
    communityId,
    firstName,
    lastName,
    phone,
    profileMediaId,
    password,
    schoolIds,
  }: UpdateSelfPayload) => {
    return withClient(
      async (client) => {
        let user: UserBase & { password: string | null };
        try {
          const [userDb] = await client.query(queries.userById, [userId, client.communityId]);
          if (!userDb) {
            throw new UnauthorizedError(ERROR_MESSAGES.USER_NOT_FOUND);
          }
          user = { ...parseUserBaseFromDb(userDb), password: userDb.password };
        } catch (e) {
          if (e instanceof UnauthorizedError) throw e;
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }

        // Sin esta comprobación, `PATCH /me` dejaba afiliarse a colegios de cualquier comunidad:
        // era la vía más directa para meter datos propios en el listado de otra.
        if (schoolIds && schoolIds.length > 0) {
          const belong = await areSchoolsInCommunity({ client, schoolIds, communityId });
          if (!belong) {
            throw new InvalidInputError(
              ERROR_MESSAGES.SCHOOLS_NOT_IN_COMMUNITY,
              "SCHOOLS_NOT_IN_COMMUNITY",
            );
          }
        }

        if (profileMediaId && profileMediaId !== (user.profileMediaId ?? null)) {
          await progressMission({
            client,
            userId,
            missionKey: MISSION_KEYS.UPDATE_PROFILE_IMAGE,
          });
        }

        firstName =
          firstName && (await safeValidateFirstName(firstName)).success
            ? firstName
            : user.firstName;
        lastName =
          lastName && (await safeValidateLastName(lastName)).success ? lastName : user.lastName;
        phone = phone && (await safeValidatePhone(phone)).success ? phone : user.phone;
        profileMediaId =
          profileMediaId && (await safeValidateUUID(profileMediaId)).success
            ? profileMediaId
            : user.profileMediaId;
        // `password` ya no es un campo válido de `updateSelfSchema` (D7, SEC-06): el schema es
        // `.strict()`, así que `PATCH /me` con `password` se rechaza antes de llegar acá. Se
        // conserva siempre el hash existente — antes, una password inválida se aceptaba en
        // silencio y dejaba el hash viejo sin avisar; ahora ese caso no puede ocurrir.
        password = user.password ?? undefined;

        try {
          await client.query(queries.updateUser, [
            // El correo se reescribe con el que ya tenía: su dominio es lo que decide a qué
            // comunidad pertenece la cuenta, así que cambiarlo acá dejaría email y comunidad
            // en desacuerdo para siempre. `community_id` tampoco se actualiza nunca.
            user.email,
            firstName,
            lastName,
            phone,
            profileMediaId,
            password,
            userId,
            client.communityId,
          ]);
          if (schoolIds) {
            await client.query(queries.deleteUserSchools, [userId, client.communityId]);
            if (schoolIds.length > 0) {
              await client.query(queries.insertUserSchools(schoolIds.length), [
                userId,
                ...schoolIds,
                client.communityId,
              ]);
            }
          }
        } catch {
          throw new InternalServerError(ERROR_MESSAGES.DATABASE_QUERY_ERROR);
        }

        const updatedUser = await getPrivateUserById({ client, userId });
        return { user: updatedUser };
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  static getSelfListings = async ({
    userId,
    communityId,
    sellerId,
    buyerId,
    searchTerm,
    categoryId,
    productStatus,
    listingStatus,
    page,
    sort,
    order,
  }: GetSelfListingsPayload) => {
    return withClient(
      async (client) => {
        const sortValue = getSortValue(sort);
        const orderValue = getOrderValue(order);
        const listingsDb = await client.query(
          queries.listings({ sort: sortValue, order: orderValue }),
          [
            searchTerm ? escapeLike(searchTerm) : null,
            listingStatus ?? null,
            categoryId ?? null,
            productStatus ?? null,
            sellerId ?? null,
            buyerId ?? null,
            userId,
            PAGE_SIZE,
            PAGE_SIZE * ((page ?? 1) - 1),
            client.communityId,
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
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSelfMissions = async ({ userId, communityId }: UserScopedPayload) => {
    return withClient(
      async (client) => {
        const missions = await getUserMissionsByUserId({ client, userId });
        return {
          missions: missions.filter((mission) => mission.missionTemplate.active),
        };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSelfNotifications = async ({ userId, communityId, page }: GetSelfPaginatedPayload) => {
    return withClient(
      async (client) => {
        const { notifications, pagination } = await getNotificationsByUserId({
          client,
          userId,
          page,
        });
        return { notifications, pagination };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSelfUnreadNotificationsCount = async ({ userId, communityId }: UserScopedPayload) => {
    return withClient(
      async (client) => {
        const result = await client.query(queries.unreadNotificationsCountByUserId, [
          userId,
          client.communityId,
        ]);
        const unreadNotificationsCount = result[0]?.unread_count ?? 0;
        return { unreadNotificationsCount };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static setAllSelfNotificationsRead = async ({ userId, communityId }: UserScopedPayload) => {
    return withClient(
      async (client) => {
        await client.query(queries.markNotificationsAsRead, [userId, client.communityId]);
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSelfChats = async ({ userId, communityId, page }: GetSelfPaginatedPayload) => {
    return withClient(
      async (client) => {
        const chatsDb = await client.query(queries.chatsByUserId, [
          userId,
          PAGE_SIZE,
          PAGE_SIZE * ((page ?? 1) - 1),
          client.communityId,
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
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSelfUnreadChatsCount = async ({ userId, communityId }: UserScopedPayload) => {
    return withClient(
      async (client) => {
        const result = await client.query(queries.unreadChatsCountByUserId, [
          userId,
          client.communityId,
        ]);
        const unreadChatsCount = safeNumber(result[0]?.unread_count) ?? 0;
        return { unreadChatsCount };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static updateNotificationToken = async ({
    userId,
    communityId,
    notificationToken,
  }: UpdateNotificationTokenPayload) => {
    return withClient(
      async (client) => {
        await client.query(queries.updateNotificationToken, [
          notificationToken,
          userId,
          client.communityId,
        ]);
      },
      { scope: inCommunity(communityId) },
    );
  };

  /**
   * Registra la aceptación de la versión de términos vigente (`terms-acceptance`, design D5).
   * Write autenticado sobre la propia fila del caller — `inCommunity` la ata a su comunidad, igual
   * que el resto de los writes de `/me`.
   */
  static acceptTerms = async ({ userId, communityId, termsVersion }: AcceptTermsPayload) => {
    return withClient(
      async (client) => {
        await client.query(queries.acceptTerms, [termsVersion, userId, client.communityId]);
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getSelfWishes = async ({ userId, communityId }: UserScopedPayload) => {
    return withClient(
      async (client) => {
        const wishesDb = await client.query(queries.getUserWishesByUserId, [
          userId,
          client.communityId,
        ]);
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
      },
      { scope: inCommunity(communityId) },
    );
  };

  static createSelfWish = async ({
    userId,
    communityId,
    categoryId,
    comment,
  }: CreateSelfWishPayload) => {
    return withClient(
      async (client) => {
        const result = await client.query(queries.createUserWish, [
          userId,
          categoryId,
          comment,
          client.communityId,
        ]);
        const userWishBase = parseUserWishFromDb(result[0]!);
        const userWish = parseUserWishFromBase({
          userWish: userWishBase,
          category: await getCategoryById({
            client,
            categoryId: userWishBase.categoryId,
          }),
        });
        return { userWish };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static deleteSelfWish = async ({ userId, communityId, categoryId }: DeleteSelfWishPayload) => {
    return withClient(
      async (client) => {
        await client.query(queries.removeUserWish, [userId, categoryId, client.communityId]);
      },
      { scope: inCommunity(communityId) },
    );
  };

  static modifyWish = async ({
    userId,
    communityId,
    wishId,
    comment,
    categoryId,
  }: ModifySelfWishPayload) => {
    return withClient(
      async (client) => {
        let wishDb: DB_UsersWishes | undefined;
        try {
          [wishDb] = await client.query(queries.userWishById, [wishId, client.communityId]);
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
          await client.query(queries.updateUserWish, [
            newWish.comment,
            newWish.categoryId,
            wishId,
            client.communityId,
          ]);
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
      },
      { scope: inCommunity(communityId) },
    );
  };

  static modifyUserPassword = async ({
    userId,
    communityId,
    newPassword,
    oldPassword,
  }: ModifyUserPasswordPayload) => {
    return withClient(
      async (client) => {
        let userDb: DB_Users | undefined;
        try {
          [userDb] = await client.query(queries.userById, [userId, client.communityId]);
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
        await client.query(queries.updateUserPassword, [
          hashedPassword,
          userId,
          client.communityId,
        ]);
      },
      { scope: inCommunity(communityId) },
    );
  };

  static deleteSelf = async ({ userId, communityId }: DeleteSelfPayload) => {
    return withClient(
      async (client) => {
        await performAccountDeletion({ client, userId });
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  // `deleteSelfByEmail` se eliminó. Estaba detrás de `POST /me/delete-request`, que se montaba sin
  // ningún middleware de autenticación: bastaba conocer el correo de alguien para borrarle la
  // cuenta entera. Ahora ese endpoint solo registra una solicitud (`models/accountDeletion.ts`) y
  // el borrado real pasa por `deleteSelf`, que exige sesión o la acción de un admin.
}
