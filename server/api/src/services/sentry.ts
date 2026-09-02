import * as Sentry from "@sentry/node";
import { NODE_ENV, SENTRY_DSN } from "../config.js";

/**
 * Reporte de errores (runtime-observability, INF-10, design D9): cableado pero inerte por
 * defecto. Sin `SENTRY_DSN` el SDK **no** se inicializa y no sale ningún request de red —
 * `initSentry()` es un no-op completo en ese caso, no solo una integración deshabilitada.
 * Habilitarlo es una decisión del operador (setear la variable), nunca un cambio de código.
 */
export const initSentry = (): void => {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    // Sin request bodies ni headers de autorización por default (requisito de la spec): el SDK
    // ya evita PII por defecto (`sendDefaultPii: false` es el default), así que no se toca acá.
  });
};

/**
 * Monta el error handler de Sentry en la app de Express. Debe llamarse después de todas las rutas
 * y antes del `errorMiddleware` propio, para que capture las excepciones no manejadas sin
 * interferir con las respuestas ya formateadas de los errores conocidos de la aplicación. No-op
 * si Sentry nunca se inicializó.
 */
export const attachSentryErrorHandler = (app: { use: (middleware: unknown) => unknown }): void => {
  if (!SENTRY_DSN) return;
  Sentry.setupExpressErrorHandler(app);
};
