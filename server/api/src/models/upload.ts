import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { dbConnection } from "../services/postgresClient";
import { queries } from "../services/queries";
import type { DatabaseClient } from "../types/dbClient";

export class UploadModel {
  static saveFile = async ({
    filename,
    mimetype,
    userId,
    isAdmin,
  }: {
    filename: string;
    mimetype: string;
    userId: UUID;
    isAdmin: boolean;
  }) => {
    let client: DatabaseClient;
    try {
      client = await dbConnection.connect();
    } catch {
      throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
    }
    try {
      const result = await client.query(queries.uploadFile, [
        filename,
        mimetype,
        "image",
        !isAdmin ? userId : null,
      ]);
      const id = result[0]?.id;
      if (!id) {
        throw new InternalServerError(ERROR_MESSAGES.DATABASE_ERROR);
      }
      const media: Media = {
        id,
        url: filename,
        mime: mimetype,
        mediaType: "image",
      };

      return { media };
    } finally {
      client.release();
    }
  };
}
