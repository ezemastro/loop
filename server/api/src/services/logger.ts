import pino from "pino";
import { NODE_ENV, LOG_LEVEL } from "../config.js";

/**
 * Logger estructurado (runtime-observability, INF-10, design D9). Reemplaza `console.*` en
 * `middlewares/errors.ts` y sirve de base para `pino-http` en `index.ts`, que crea un logger hijo
 * por request con el id de correlación ya inyectado (`req.log`).
 *
 * - En desarrollo usa el transporte `pino-pretty` (coloreado, legible). En cualquier otro entorno
 *   emite JSON de línea única, apto para un colector de logs.
 * - `redact` evita que credenciales lleguen al stream de logs: el header `Authorization`, la
 *   cookie de sesión y cualquier campo `password` en el cuerpo de la request u otros objetos
 *   logueados. `censor` deja un placeholder en vez de omitir la clave, así queda claro que el dato
 *   existía pero fue eliminado a propósito.
 */
export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "*.password"],
    censor: "[REDACTED]",
  },
  transport:
    NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
});
