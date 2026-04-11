import type { NextFunction, Request, Response } from "express";
import fs from "fs";
import {
  ERROR_MESSAGES,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  IMAGE_QUALITY,
  MAX_UPLOAD_SIZE_BYTES,
  UPLOAD_DIR,
} from "../config";
import multer from "multer";
import path from "path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { InvalidInputError } from "./errors";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new InvalidInputError(ERROR_MESSAGES.INVALID_FILE_TYPE));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter,
});

export const optimizeUploadedImage = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.file) {
    return next(new InvalidInputError(ERROR_MESSAGES.FILE_NOT_FOUND));
  }

  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    await sharp(req.file.buffer)
      .rotate()
      .resize({
        width: IMAGE_MAX_WIDTH,
        height: IMAGE_MAX_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY, effort: 4 })
      .toFile(filePath);

    const { size } = fs.statSync(filePath);
    req.file.filename = filename;
    req.file.mimetype = "image/webp";
    req.file.path = filePath;
    req.file.size = size;

    return next();
  } catch (_error) {
    return next(new InvalidInputError("No se pudo procesar la imagen"));
  }
};

// Función para eliminar un archivo
export const deleteFile = (filename: string) => {
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error al eliminar el archivo ${filename}:`, err);
    }
  });
};
