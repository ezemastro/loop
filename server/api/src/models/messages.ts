import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError, InvalidInputError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { getListingById } from "../utils/helpersDb";
import { sendMessageNotification } from "../utils/notifications";
import {
  parseMessageBaseFromDb,
  parseMessageFromBase,
  parsePagination,
} from "../utils/parseDb";
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
    // Obtener cliente de base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Obtener mensajes
      const messagesDb = await client.query(
        queries.messagesBySenderAndRecipient,
        [senderId, recipientId, PAGE_SIZE, PAGE_SIZE * ((page ?? 1) - 1)],
      );
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
      // Devolver mensajes
      return { messages, pagination };
    } finally {
      client.release();
    }
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
    // Obtener cliente de base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Enviar mensaje
      const [newMessage] = await client.query(queries.newMessage, [
        senderId,
        recipientId,
        text,
        attachedListingId ?? null,
      ]);
      // Obtener nombre del remitente
      const senderDb = await client.query(queries.userById, [senderId]);
      if (senderDb.length === 0)
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      const senderName = `${senderDb[0]!.first_name} ${senderDb[0]!.last_name}`;
      // Obtener token de notificación del destinatario
      const recipientDb = await client.query(queries.userById, [recipientId]);
      if (recipientDb.length === 0)
        throw new InvalidInputError(ERROR_MESSAGES.USER_NOT_FOUND);
      // Enviar notificación
      await sendMessageNotification({
        senderName,
        message: text,
        client,
        userId: recipientId,
        notificationToken: recipientDb[0]!.notification_token,
      });
      // Devolver mensaje enviado
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
    } finally {
      client.release();
    }
  }
  static async markMessagesAsRead({
    userId,
    senderId,
  }: {
    userId: UUID;
    senderId: UUID;
  }) {
    // Obtener cliente de base de datos
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      // Marcar mensajes como leídos
      await client.query(queries.markMessagesAsRead, [userId, senderId]);
      return;
    } finally {
      client.release();
    }
  }
}
