import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InvalidInputError } from "../services/errors";
import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type { DonatePayload, GetUserByIdPayload, GetUsersPayload } from "../types/models";
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
            searchTerm || null,
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

  static donate = async ({ fromUserId, toUserId, amount, communityId }: DonatePayload) => {
    return withClient(
      async (client) => {
        if (fromUserId === toUserId) {
          throw new InvalidInputError(ERROR_MESSAGES.INVALID_INPUT);
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
        const fromUser = parseUserBaseFromDb(fromUserDb);
        if (fromUser.credits.balance < amount) {
          throw new InvalidInputError(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
        }
        await client.query(queries.updateUserBalance, [
          fromUser.credits.balance - amount,
          fromUser.credits.locked,
          fromUserId,
          client.communityId,
        ]);
        await client.query(queries.updateUserBalance, [
          toUser.credits.balance + amount,
          toUser.credits.locked,
          toUserId,
          client.communityId,
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
