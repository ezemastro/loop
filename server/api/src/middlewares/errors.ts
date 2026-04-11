import type { Request, Response, NextFunction } from "express";
import { ERROR_MESSAGES } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  StepRequired,
  UnauthorizedError,
} from "../services/errors";
import multer from "multer";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ success: false, error: ERROR_MESSAGES.FILE_TOO_LARGE });
    }
    return res
      .status(400)
      .json({ success: false, error: ERROR_MESSAGES.INVALID_INPUT });
  }
  if (err instanceof InvalidInputError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err instanceof ConflictError) {
    return res.status(409).json({ success: false, error: err.message });
  }
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ success: false, error: err.message });
  }
  if (err instanceof InternalServerError) {
    console.error("Error en la aplicación:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
  if (err instanceof StepRequired) {
    return res.status(200).json({ success: false, error: err.message });
  }
  console.error("Error no manejado:", err);
  return res
    .status(500)
    .json({ success: false, error: "Error interno del servidor" });
};
