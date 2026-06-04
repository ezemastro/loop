import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";

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
    return withClient(async (client) => {
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
    });
  };
}
