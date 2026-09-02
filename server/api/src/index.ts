import express from "express";
import helmet from "helmet";
import { randomUUID } from "crypto";
import pinoHttp from "pino-http";
import {
  FRONTEND_URL,
  NODE_ENV,
  PORT,
  ADMIN_FRONTEND_URL,
  AUTHORIZED_ADMIN_EMAIL,
} from "./config.js";
import { assertProductionEnv } from "./env.js";
import { logger } from "./services/logger.js";
import { initSentry, attachSentryErrorHandler } from "./services/sentry.js";
import cookieParser from "cookie-parser";
import { optionalTokenMiddleware, tokenMiddleware } from "./middlewares/parseToken.js";
import { authRouter } from "./routes/auth.js";
import { selfRouter } from "./routes/self.js";
import { usersRouter } from "./routes/users.js";
import { schoolsRouter } from "./routes/schools.js";
import { categoriesRouter } from "./routes/categories.js";
import { listingsRouter } from "./routes/listings.js";
import { messagesRouter } from "./routes/messages.js";
import { adminRouter } from "./routes/admin.js";
import { communitiesRouter } from "./routes/communities.js";
import { accountDeletionAdminRouter } from "./routes/accountDeletion.js";
import { errorMiddleware } from "./middlewares/errors.js";
import { uploadsRouter } from "./routes/uploads.js";
import { safeNumber } from "./utils/safeNumber.js";
import cors from "cors";
import { trimBody } from "./middlewares/trimBody.js";
import { deleteRequestLimiter } from "./middlewares/rateLimit.js";
import { statsRouter } from "./routes/stats.js";
import { assertDbHardening, checkHealth, unscoped, withClient } from "./services/postgresClient.js";
import { queries } from "./services/queries.js";

import { AccountDeletionController } from "./controllers/accountDeletion.js";

// SEC-01 / C11: la validación de entorno tiene que completarse antes de aceptar cualquier
// conexión. Fuera de producción no hace nada (la permisividad de `env.ts` ya alcanza).
assertProductionEnv();

// runtime-observability (INF-10, D9): no-op si `SENTRY_DSN` no está seteada — ni se inicializa el
// SDK ni sale tráfico de red. Antes de montar cualquier middleware para que capture todo lo que
// pase por la app.
initSentry();

/**
 * En desarrollo el front se abre desde la máquina que corre Docker y también desde otros
 * dispositivos de la LAN (celular, otra notebook), así que el origen cambia con la IP privada del
 * host y con el puerto de cada módulo. Enumerarlos a mano dejaba fuera cualquier IP nueva, así que
 * se acepta localhost y cualquier IPv4 privada en cualquier puerto. Solo aplica a NODE_ENV=development.
 */
const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

export const app = express();

// Un solo hop de proxy (Caddy). `true` dejaría que cualquier cliente falsifique
// `X-Forwarded-For` y elija su propia clave de rate limit (D3).
app.set("trust proxy", 1);

// `helmet` va primero: así los headers de seguridad están presentes incluso en una respuesta de
// error del body parser. `crossOriginResourcePolicy` se fija explícito porque el default de
// helmet (`same-origin`) bloquearía las imágenes subidas cuando las consume un origen distinto
// (web de Expo, panel de admin) — es el punto más probable en que este cambio rompe la UI (D12).
// `contentSecurityPolicy` se apaga: es una API JSON, y el default de helmet aplicaría
// `default-src 'self'` también a `/uploads`, servido estáticamente.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
// CORS antes que el body parser: antes el body se parseaba (`:43` original) antes de evaluar el
// origen (`:45` original). Ahora el origen se resuelve primero.
app.use(
  cors({
    credentials: true,
    origin:
      NODE_ENV === "development"
        ? DEV_ORIGIN_PATTERN
        : [FRONTEND_URL ?? "", ADMIN_FRONTEND_URL ?? ""],
    allowedHeaders: ["Content-Type", "Authorization"],
    // El cliente de Expo lo lee para renovar en silencio los tokens emitidos antes de que
    // existieran las comunidades.
    exposedHeaders: ["X-Refreshed-Token"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  }),
);
// El límite ya era 100kb por default de Express (SEC-15/C7); esto lo hace explícito en vez de
// heredarlo en silencio.
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
// runtime-observability (INF-10, D9): reemplaza a `morgan`, que solo corría en desarrollo
// (`NODE_ENV === "development"`) y dejaba a producción sin ningún log de request. `genReqId`
// reutiliza el `X-Request-Id` entrante si el caller (o un proxy upstream) ya lo trae, y si no
// genera uno nuevo; en ambos casos se devuelve en la respuesta para poder correlacionar un
// reporte de un usuario con sus propios registros.
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const inbound = req.headers["x-request-id"];
      const id = (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
  }),
);

// Liveness: no toca la base, así el orquestador distingue "el proceso está arriba" de "las
// dependencias están sanas". No debe filtrar el entorno de deploy (SEC-15).
app.get("/status", (_req, res) => {
  res.status(200).send("ok");
});

// Health: sí toca la base. Cuerpo deliberadamente grueso (arriba/abajo, on/off) — nunca versión,
// hostname, error del driver ni NODE_ENV — porque este endpoint es no autenticado por necesidad.
// No lleva rate limit: lo consulta un monitor de uptime.
app.get("/health", async (_req, res) => {
  const { dbUp, rlsOn } = await checkHealth();
  res.set("Cache-Control", "no-store");
  if (!dbUp) {
    return res.status(503).json({ status: "down", db: "down" });
  }
  if (!rlsOn) {
    return res.status(503).json({ status: "degraded", db: "up", rls: "off" });
  }
  return res.status(200).json({ status: "ok", db: "up", rls: "on" });
});

// Público: la landing lo usa para el borrado de cuenta que exigen las tiendas. Ya no borra nada,
// solo deja registrada la solicitud para que un admin la ejecute.
app.post(
  "/me/delete-request",
  trimBody,
  deleteRequestLimiter,
  AccountDeletionController.requestDeletion,
);

// ─── Rutas públicas ────────────────────────────────────────────────────────────────────────────
app.use("/auth", trimBody, authRouter);
// Catálogo de comunidades: lo consulta la pantalla de registro para resolver la comunidad a partir
// del dominio del correo.
app.use("/communities", trimBody, communitiesRouter);
// El catálogo de categorías se comparte entre comunidades, así que no expone datos de nadie.
app.use("/categories", trimBody, categoriesRouter);
// Semi-público: el selector de colegios corre antes del registro, pero el controller exige saber
// de qué comunidad, y si hay sesión la de la sesión siempre gana.
app.use("/schools", trimBody, optionalTokenMiddleware, schoolsRouter);

// ─── Rutas que exigen sesión ───────────────────────────────────────────────────────────────────
// `tokenMiddleware` se monta acá y no ruta por ruta: así una ruta nueva no puede nacer
// desprotegida por olvido. `/listings`, `/users` y `/stats` eran públicas y globales hasta ahora,
// lo que las convertía en la vía más directa para ver datos de otra comunidad.
app.use("/me", trimBody, tokenMiddleware, selfRouter);
app.use("/users", trimBody, tokenMiddleware, usersRouter);
app.use("/listings", trimBody, tokenMiddleware, listingsRouter);
app.use("/messages", trimBody, tokenMiddleware, messagesRouter);
app.use("/stats", trimBody, tokenMiddleware, statsRouter);

// ─── Otros ─────────────────────────────────────────────────────────────────────────────────────
// La subida exige sesión (lo valida el router); la lectura estática sigue siendo pública.
app.use("/uploads", trimBody, uploadsRouter);
app.use("/admin", trimBody, adminRouter);
app.use("/admin/deletion-requests", trimBody, accountDeletionAdminRouter);

// runtime-observability (INF-10, D9): debe montarse después de todas las rutas y antes del
// `errorMiddleware` propio, para no interferir con el formato de respuesta de los errores
// conocidos de la aplicación. No-op si Sentry nunca se inicializó (sin `SENTRY_DSN`).
attachSentryErrorHandler(app);
app.use(errorMiddleware);

// Asegurar que el email de admin autorizado por env esté en admin_valid_emails
if (AUTHORIZED_ADMIN_EMAIL) {
  withClient(
    async (client) => {
      try {
        await client.query(queries.ensureAuthorizedAdminEmail, [AUTHORIZED_ADMIN_EMAIL]);
        console.log(`Admin autorizado por env asegurado: ${AUTHORIZED_ADMIN_EMAIL}`);
      } catch (err) {
        console.error("No se pudo asegurar el admin autorizado por env:", err);
      }
    },
    { scope: unscoped("bootstrap") },
  );
}

const listen = () =>
  app.listen(safeNumber(PORT) || 3000, "0.0.0.0", () => {
    console.log(`Servidor corriendo. Entorno: ${NODE_ENV} en el puerto ${PORT}`);
  });

/**
 * Verifica que el aislamiento por comunidad esté realmente activo, y recién ahí abre el puerto.
 *
 * Antes (C11) `assertDbHardening()` corría fire-and-forget mientras `app.listen` seguía de largo
 * sin esperarlo, así que el proceso podía aceptar tráfico antes de que el chequeo resolviera. En
 * producción ahora se espera y, si falla, el proceso sale sin llegar a escuchar. Fuera de
 * producción el chequeo sigue sin bloquear el arranque: solo loguea si algo está mal.
 */
export let server: ReturnType<typeof listen> | undefined;

if (NODE_ENV === "test") {
  server = listen();
} else if (NODE_ENV === "production") {
  assertDbHardening()
    .then(() => {
      server = listen();
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
} else {
  assertDbHardening().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
  });
  server = listen();
}
