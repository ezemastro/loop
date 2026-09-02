import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InvalidInputError, NotFoundError } from "../services/errors";
import { inCommunity, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type {
  GetMessagesFromUserPayload,
  MarkMessagesAsReadPayload,
  SendMessagePayload,
} from "../types/models.js";
import { getListingById } from "../utils/helpersDb";
import { sendMessageNotification } from "../utils/notifications";
import { parseMessageBaseFromDb, parseMessageFromBase, parsePagination } from "../utils/parseDb";
import { safeNumber } from "../utils/safeNumber";

export class MessagesModel {
  static async getMessagesFromUser({
    senderId,
    recipientId,
    page,
    communityId,
  }: GetMessagesFromUserPayload) {
    return withClient(
      async (client) => {
        const _page = Math.max(1, page ?? 1);
        const messagesDb = await client.query(queries.messagesBySenderAndRecipient, [
          senderId,
          recipientId,
          PAGE_SIZE,
          PAGE_SIZE * (_page - 1),
          client.communityId,
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
      },
      { scope: inCommunity(communityId) },
    );
  }

  static async sendMessageToUser({
    senderId,
    recipientId,
    text,
    attachedListingId,
    communityId,
  }: SendMessagePayload) {
    return withClient(
      async (client) => {
        const [senderDb] = await client.query(queries.userById, [senderId, client.communityId]);
        if (!senderDb) throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
        const senderName = `${senderDb.first_name} ${senderDb.last_name}`;

        // El destinatario se busca ANTES de insertar: la búsqueda va scopeada a la comunidad, así
        // que un destinatario de otra comunidad no aparece y esto corta con 404. Antes el INSERT
        // iba primero y se podía escribirle a cualquier usuario de la base.
        const [recipientDb] = await client.query(queries.userById, [
          recipientId,
          client.communityId,
        ]);
        if (!recipientDb) throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);

        const [newMessage] = await client.query(queries.newMessage, [
          senderId,
          recipientId,
          text,
          attachedListingId ?? null,
          communityId,
        ]);
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
            createdAt: new Date().toISOString(),
            senderId,
            recipientId,
            text,
          },
          listing: attachedListingId
            ? await getListingById({ client, listingId: attachedListingId })
            : null,
        });
        return { message };
      },
      { scope: inCommunity(communityId) },
    );
  }

  static async markMessagesAsRead({ userId, senderId, communityId }: MarkMessagesAsReadPayload) {
    return withClient(
      async (client) => {
        await client.query(queries.markMessagesAsRead, [userId, senderId, client.communityId]);
      },
      { scope: inCommunity(communityId) },
    );
  }
}
