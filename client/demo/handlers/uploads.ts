import { on } from "../router";
import { getDemoDb } from "../state";
import { newUuid } from "../ids";

let mediaIndex = 0;

export const registerUploadsHandlers = () => {
  on("post", "/uploads", () => {
    const db = getDemoDb();
    const media: Media = {
      id: newUuid(),
      // Las URLs absolutas pasan por `getUrl` sin prefijo, así la imagen se sirve desde picsum.
      url: `https://picsum.photos/seed/loop-demo-upload-${mediaIndex++}/800/600`,
      mime: "image/jpeg",
      mediaType: "image",
    };
    db.mediaRegistry.set(media.id, media);
    return { data: { success: true, data: { media } } };
  });
};
