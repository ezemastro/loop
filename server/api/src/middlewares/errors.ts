import type { Request, Response, NextFunction } from "express";
import { ERROR_MESSAGES } from "../config";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
  NotFoundError,
  StepRequired,
  UnauthorizedError,
} from "../services/errors";
import multer from "multer";
import { logger } from "../services/logger";

export const errorMiddleware = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  // `req.log` es el logger hijo que crea `pino-http` por request (index.ts): ya trae el id de
  // correlación inyectado, así que un registro de error acá cae en el mismo stream que el resto
  // de esa request. Si por lo que sea `pino-http` no llegó a correr (por ejemplo, un error que
  // ocurre fuera de una request real, en un test), se cae al logger base.
  const requestLogger = req.log ?? logger;
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: ERROR_MESSAGES.FILE_TOO_LARGE,
        errorCode: "FILE_TOO_LARGE",
      });
    }
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.INVALID_INPUT,
      errorCode: "INVALID_INPUT",
    });
  }
  if (err instanceof InvalidInputError) {
    return res.status(400).json({ success: false, error: err.message, errorCode: err.code });
  }
  if (err instanceof ConflictError) {
    return res.status(409).json({ success: false, error: err.message, errorCode: err.code });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ success: false, error: err.message, errorCode: err.code });
  }
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ success: false, error: err.message, errorCode: err.code });
  }
  if (err instanceof InternalServerError) {
    requestLogger.error({ err }, "Error en la aplicación");
    return res.status(500).json({ success: false, error: err.message, errorCode: err.code });
  }
  if (err instanceof StepRequired) {
    // 409, no 200 (SEC-15, D14): un paso pendiente no es un éxito. Antes el 200 hacía que el
    // cliente tratara la respuesta como un objeto plano sin `data` (rama no-Axios de
    // `parseApiError`), así que `SCHOOL_IDS_REQUIRED_FOR_GOOGLE_SIGNUP` perdía la comunidad
    // pre-resuelta que este error trae en `data`. Con 409 la respuesta pasa por la rama Axios, que
    // sí preserva `data`. `success`, `error`, `errorCode` y `data` mantienen su forma exacta.
    return res.status(409).json({
      success: false,
      error: err.message,
      errorCode: err.code,
      ...(err.data ? { data: err.data } : {}),
    });
  }
  requestLogger.error({ err }, "Error no manejado");
  return res
    .status(500)
    .json({ success: false, error: "Error interno del servidor", errorCode: "INTERNAL_ERROR" });
};
