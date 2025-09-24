import type { Request, Response, NextFunction } from "express";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  UnauthorizedError,
} from "../services/errors";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.log(err.message);
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
  console.error("Error no manejado:", err);
  return res
    .status(500)
    .json({ success: false, error: "Error interno del servidor" });
};
