import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InvalidInputError } from "../services/errors";
import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import { getListingById } from "../utils/helpersDb";
import { sendMessageNotification } from "../utils/notifications";
import { parseMessageBaseFromDb, parseMessageFromBase, parsePagination } from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";

export class MessagesModel {
  static async getMessagesFromUser({
    senderId,
    recipientId,
    page,
  }: {
    senderId: UUID;
    recipientId: UUID;
    page: number | undefined;
  }) {
    return withClient(async (client) => {
      const _page = Math.max(1, page ?? 1);
      const messagesDb = await client.query(queries.messagesBySenderAndRecipient, [
        senderId,
        recipientId,
        PAGE_SIZE,
        PAGE_SIZE * (_page - 1),
      ]);
      const messages = await Promise.all(
        messagesDb.map(async (msg) => {
          const messageBase = parseMessageBaseFromDb(msg);
          return parseMessageFromBase({
            message: messageBase,
            listing: messageBase.attachedListingId
              ? await getListingById({
                  client,
                  listingId: messageBase.attachedListingId,
                })
              : null,
          });
        }),
      );
      const pagination = parsePagination({
        currentPage: page ?? 1,
        totalRecords: safeNumber(messagesDb[0]?.total_records) || 0,
      });
      return { messages, pagination };
    });
  }

  static async sendMessageToUser({
    senderId,
    recipientId,
    text,
    attachedListingId,
  }: {
    senderId: string;
    recipientId: string;
    text: string;
    attachedListingId?: string | null;
  }) {
    return withClient(async (client) => {
      const [newMessage] = await client.query(queries.newMessage, [
        senderId,
        recipientId,
        text,
        attachedListingId ?? null,
      ]);
      const [senderDb] = await client.query(queries.userById, [senderId]);
      if (!senderDb) throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      const senderName = `${senderDb.first_name} ${senderDb.last_name}`;
      const [recipientDb] = await client.query(queries.userById, [recipientId]);
      if (!recipientDb) throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      await sendMessageNotification({
        senderName,
        message: text,
        client,
        userId: recipientId,
        notificationToken: recipientDb.notification_token,
      });
      const message = parseMessageFromBase({
        message: {
          id: newMessage!.id,
          createdAt: new Date(),
          senderId,
          recipientId,
          text,
        },
        listing: attachedListingId
          ? await getListingById({ client, listingId: attachedListingId })
          : null,
      });
      return { message };
    });
  }

  static async markMessagesAsRead({ userId, senderId }: { userId: UUID; senderId: UUID }) {
    return withClient(async (client) => {
      await client.query(queries.markMessagesAsRead, [userId, senderId]);
    });
  }
}
