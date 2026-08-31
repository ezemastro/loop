import express from "express";
import {
  FRONTEND_URL,
  NODE_ENV,
  PORT,
  ADMIN_FRONTEND_URL,
  AUTHORIZED_ADMIN_EMAIL,
} from "./config.js";
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
import { statsRouter } from "./routes/stats.js";
import { assertDbHardening, unscoped, withClient } from "./services/postgresClient.js";
import { queries } from "./services/queries.js";

import { AccountDeletionController } from "./controllers/accountDeletion.js";

/**
 * En desarrollo el front se abre desde la máquina que corre Docker y también desde otros
 * dispositivos de la LAN (celular, otra notebook), así que el origen cambia con la IP privada del
 * host y con el puerto de cada módulo. Enumerarlos a mano dejaba fuera cualquier IP nueva, así que
 * se acepta localhost y cualquier IPv4 privada en cualquier puerto. Solo aplica a NODE_ENV=development.
 */
const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

export const app = express();

app.use(express.json());
app.use(cookieParser());
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
if (NODE_ENV === "development") {
  import("morgan").then((module) => {
    const morgan = module.default;
    app.use(morgan("dev"));
  });
}

app.get("/status", (req, res) => {
  res.status(200).send(`Server is running. Environment: ${NODE_ENV}`);
});

// Público: la landing lo usa para el borrado de cuenta que exigen las tiendas. Ya no borra nada,
// solo deja registrada la solicitud para que un admin la ejecute.
app.post("/me/delete-request", trimBody, AccountDeletionController.requestDeletion);

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

// Verifica que el aislamiento por comunidad esté realmente activo. En producción es fatal: es
// preferible no levantar a levantar con RLS apagada y no enterarse.
if (NODE_ENV !== "test") {
  assertDbHardening().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    if (NODE_ENV === "production") process.exit(1);
  });
}

// Iniciar el servidor
export const server = app.listen(safeNumber(PORT) || 3000, "0.0.0.0", () => {
  console.log(`Servidor corriendo. Entorno: ${NODE_ENV} en el puerto ${PORT}`);
});
