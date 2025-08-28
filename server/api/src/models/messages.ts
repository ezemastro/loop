import { ERROR_MESSAGES, PAGE_SIZE } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";
import { getListingById } from "../utils/helpersDb";
import { parseMessageBaseFromDb, parseMessageFromBase } from "../utils/parseDb";

export class MessagesModel {
  static async getMessagesFromUser({
    senderId,
    recipientId,
    page,
  }: {
    senderId: UUID;
    recipientId: UUID;
    page: number;
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
        [senderId, recipientId, PAGE_SIZE, page ? (page - 1) * PAGE_SIZE : 0],
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
      // Devolver mensajes
      return { messages };
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
      // TODO - Enviar notificación
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
}
