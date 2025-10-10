import type { NextFunction, Request, Response } from "express";
import { BASE_URL, ERROR_MESSAGES } from "../config";
import { InvalidInputError } from "../services/errors";
import { UploadModel } from "../models/upload";
import { successResponse } from "../utils/responses";
import { deleteFile } from "../services/uploads";

export class UploadsController {
  static upload = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new InvalidInputError(ERROR_MESSAGES.FILE_NOT_FOUND));
    }
    let media: Media;
    try {
      ({ media } = await UploadModel.saveFile({
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        userId: req.session!.isAdmin
          ? req.session!.adminId!
          : req.session!.userId!,
      }));
    } catch (error) {
      // Eliminar el archivo subido en caso de error
      deleteFile(req.file.filename);
      return next(error);
    }
    const publicUrl = `${BASE_URL}/uploads/${media.url}`;
    res
      .status(201)
      .json(successResponse({ data: { media: { ...media, url: publicUrl } } }));
  };
}
