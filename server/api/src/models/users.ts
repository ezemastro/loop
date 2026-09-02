import { DONATION_DAILY_MAX_CREDITS, ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InvalidInputError } from "../services/errors";
import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type { DonatePayload, GetUserByIdPayload, GetUsersPayload } from "../types/models";
import { applyCreditMovements } from "../utils/credits.js";
import { getCategoryById, getUserById, getUsersByIds } from "../utils/helpersDb";
import { sendDonationNotification } from "../utils/notifications";
import {
  parsePagination,
  parseUserBaseFromDb,
  parseUserWishFromBase,
  parseUserWishFromDb,
} from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";
import { getOrderValue, getSortValue } from "../utils/sortOptions";
import { escapeLike } from "../utils/escapeLike";

export class UsersModel {
  static getUsers = async ({
    communityId,
    page = 1,
    sort,
    order,
    searchTerm,
    schoolId,
    userId,
  }: GetUsersPayload) => {
    return withClient(
      async (client) => {
        const dbSort = getSortValue(sort);
        const dbOrder = getOrderValue(order);
        const usersSearchDb = await client.query(
          queries.searchUsers({ sort: dbSort, order: dbOrder }),
          [
            searchTerm ? escapeLike(searchTerm) : null,
            schoolId || null,
            userId || null,
            PAGE_SIZE,
            page ? (page - 1) * PAGE_SIZE : 0,
            client.communityId,
          ],
        );
        const totalRecords = safeNumber(usersSearchDb[0]?.total_records || 0);
        const userIds = usersSearchDb.map((u) => u.id);
        const usersMap = await getUsersByIds({ client, userIds });
        const users = userIds.map((id) => usersMap.get(id)!);
        return {
          users,
          pagination: parsePagination({
            currentPage: page,
            totalRecords: totalRecords || 0,
          }),
        };
      },
      { scope: inCommunity(communityId) },
    );
  };

  static getUserById = async ({ userId, communityId }: GetUserByIdPayload) => {
    return withClient(
      async (client) => {
        const user = await getUserById({ client, userId });
        return { user };
      },
      { scope: inCommunity(communityId) },
    );
  };

  /**
   * credit-ledger: "A donation records both sides", "Donation Limits". El mínimo/máximo por
   * request ya los aplica el Zod schema (`validateDonateRequest`); acá se aplica el único límite
   * que depende de estado — el tope diario, leído del ledger — y las dos escrituras pasan por el
   * choque único en vez de dos escrituras absolutas sueltas.
   */
  static donate = async ({ fromUserId, toUserId, amount, communityId }: DonatePayload) => {
    return withClient(
      async (client) => {
        if (fromUserId === toUserId) {
          throw new InvalidInputError(
            ERROR_MESSAGES.CANNOT_DONATE_TO_SELF,
            "CANNOT_DONATE_TO_SELF",
          );
        }
        const [toUserDb] = await client.query(queries.userById, [toUserId, client.communityId]);
        if (!toUserDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }
        const toUser = parseUserBaseFromDb(toUserDb);
        const [fromUserDb] = await client.query(queries.userById, [fromUserId, client.communityId]);
        if (!fromUserDb) {
          throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        const [donationTotalRow] = await client.query(queries.donationSentTodayTotal, [
          fromUserId,
          client.communityId,
        ]);
        const donatedToday = Number(donationTotalRow?.total ?? 0);
        if (donatedToday + amount > DONATION_DAILY_MAX_CREDITS) {
          throw new InvalidInputError(
            ERROR_MESSAGES.DONATION_DAILY_CAP_EXCEEDED,
            "DONATION_DAILY_CAP_EXCEEDED",
          );
        }

        // El guard de `applyCreditMovements` es lo que hace la carrera "dos donaciones simultáneas
        // de todo el saldo" segura (credit-ledger: "Concurrent donations cannot overdraw") — no el
        // chequeo de saldo en JS, que quedó afuera a propósito.
        await applyCreditMovements(client, [
          {
            userId: fromUserId,
            balanceDelta: -amount,
            lockedDelta: 0,
            reason: "donation_sent",
            referenceId: toUserId,
          },
          {
            userId: toUserId,
            balanceDelta: amount,
            lockedDelta: 0,
            reason: "donation_received",
            referenceId: fromUserId,
          },
        ]);

        await sendDonationNotification({
          client,
          amount,
          donorUserId: fromUserId,
          userId: toUserId,
          message: null,
          notificationToken: toUser.notificationToken,
        });
      },
      { scope: inCommunity(communityId), transaction: true },
    );
  };

  static getUserWishes = async ({ userId, communityId }: GetUserByIdPayload) => {
    return withClient(
      async (client) => {
        const userWishesDb = await client.query(queries.getUserWishesByUserId, [
          userId,
          client.communityId,
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
      },
      { scope: inCommunity(communityId) },
    );
  };
}
