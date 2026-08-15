import { ERROR_MESSAGES } from "../config";
import { InternalServerError } from "../services/errors";
import { inCommunity, unscoped, withClient } from "../services/postgresClient.js";
import { queries } from "../services/queries";
import type { SaveFilePayload } from "../types/models";

export class UploadModel {
  /**
   * La media que sube un usuario queda con su comunidad. La del panel de admin va sin comunidad
   * (`community_id` nulo): son los logos de comunidades y colegios, que tienen que verse desde
   * cualquier scope, incluida la pantalla de registro.
   */
  static saveFile = async ({
    filename,
    mimetype,
    userId,
    isAdmin,
    communityId,
  }: SaveFilePayload) => {
    return withClient(
      async (client) => {
        const result = await client.query(queries.uploadFile, [
          filename,
          mimetype,
          "image",
          !isAdmin ? userId : null,
          client.communityId,
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
      },
      { scope: communityId ? inCommunity(communityId) : unscoped("admin") },
    );
  };
}
