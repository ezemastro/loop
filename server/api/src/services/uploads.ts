import type { Request } from "express";
import fs from "fs";
import { UPLOAD_DIR } from "../config";
import multer from "multer";
import path from "path";
import { randomUUID } from "node:crypto";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, randomUUID() + ext);
  },
});
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de archivo no permitido"));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// Función para eliminar un archivo
export const deleteFile = (filename: string) => {
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error al eliminar el archivo ${filename}:`, err);
    }
  });
};
