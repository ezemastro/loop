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
  if (err instanceof InvalidInputError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof ConflictError) {
    return res.status(409).json({ error: err.message });
  }
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ error: err.message });
  }
  if (err instanceof InternalServerError) {
    console.error("Error en la aplicación:", err);
    return res.status(500).json({ error: err.message });
  }
};
