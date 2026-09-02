import type { NextFunction, Request, Response } from "express";
import path from "node:path";
import { BASE_URL, ERROR_MESSAGES, MEDIA_URL_SIGNING_ENABLED } from "../config";
import { InvalidInputError } from "../services/errors";
import { UploadModel } from "../models/upload";
import { errorResponse, successResponse } from "../utils/responses";
import { deleteFile } from "../services/uploads";
import { signMediaUrl, verifyMediaSignature } from "../services/mediaSigning";

export class UploadsController {
  static upload = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new InvalidInputError(ERROR_MESSAGES.FILE_NOT_FOUND));
    }
    const { userId, communityId, isAdmin } = req.session!;
    // Un usuario sin comunidad resuelta no puede subir nada: la media quedaría huérfana de scope.
    if (!isAdmin && !communityId) {
      deleteFile(req.file.filename);
      return next(new InvalidInputError(ERROR_MESSAGES.COMMUNITY_REQUIRED, "COMMUNITY_REQUIRED"));
    }
    let media: Media;
    try {
      ({ media } = await UploadModel.saveFile({
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        userId,
        isAdmin: isAdmin || false,
        // Las subidas del panel de admin son media compartida: van sin comunidad.
        communityId: isAdmin ? null : communityId!,
      }));
    } catch (error) {
      // Eliminar el archivo subido en caso de error
      deleteFile(req.file.filename);
      return next(error);
    }
    // `UploadModel.saveFile` returns `media.url` unsigned (it comes straight from the insert, not
    // through `parseMediaFromDb`), so this response builds its own URL independently and must be
    // signed here too (spec `media-access-control`, "Every media-bearing response is signed").
    const signedFilename = MEDIA_URL_SIGNING_ENABLED ? signMediaUrl(media.url) : media.url;
    const publicUrl = `${BASE_URL}/uploads/${signedFilename}`;
    res.status(201).json(successResponse({ data: { media: { ...media, url: publicUrl } } }));
  };

  /**
   * Signature gate in front of `express.static` for `GET /uploads/*` (SEC-08, design D7).
   *
   * When signing is disabled this is a no-op (`next()`): `routes/uploads.ts` falls straight
   * through to `express.static`, byte-identical to today's behaviour (spec `media-access-control`,
   * "Rollout Is Reversible"). When enabled, an unsigned/tampered/expired request is refused with
   * 403 *before* reaching the filesystem — `express.static` still owns the actual streaming, so
   * `Content-Type`/caching headers are exactly what they were before this change.
   *
   * `path.basename` on the request path is deliberate, not just for reading the filename: it
   * collapses any `../` a caller could smuggle in, so the signature is always checked against the
   * same bare filename `express.static` will resolve *inside* `UPLOAD_DIR` — never a path that
   * could escape it.
   */
  static verifySignature = (req: Request, res: Response, next: NextFunction) => {
    if (!MEDIA_URL_SIGNING_ENABLED) return next();

    const filename = path.basename(req.path);
    const exp = Number(req.query.exp);
    const sig = typeof req.query.sig === "string" ? req.query.sig : "";

    if (!verifyMediaSignature({ filename, exp, sig })) {
      return res.status(403).json(errorResponse(ERROR_MESSAGES.FILE_NOT_FOUND));
    }
    return next();
  };
}
