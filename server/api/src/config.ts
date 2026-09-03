import type { CookieOptions } from "express";
import path from "path";

try {
  if (process.env.NODE_ENV !== "production") {
    const dotenv = require("dotenv");
    dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
    console.log("Variables de entorno locales cargadas.");
  }
} catch {
  // Silencioso en prod o si dotenv no está disponible
}

import { env } from "./env.js";

/**
 * Re-exporta desde `env.ts` (SEC-01): ahí vive el schema de Zod, el default de cada variable y el
 * chequeo estricto de producción. Este módulo solo le da a los ~40 sitios que hoy importan
 * `config.js` los mismos nombres de siempre, para que ningún call site tenga que cambiar.
 *
 * Deliberado: `config.ts` nunca aborta el proceso por sí solo. Lo importan también
 * `scripts/migrate.ts` y `scripts/seed.ts`, que corren con otro juego de variables — el chequeo
 * estricto (`assertProductionEnv`) vive aparte, en `env.ts`, y solo lo llama el entrypoint de la
 * API (`index.ts`).
 */
export const NODE_ENV = env.NODE_ENV;
export const FRONTEND_URL = env.FRONTEND_URL;
export const DB_USER = env.POSTGRES_USER;
export const DB_NAME = env.POSTGRES_DB;
export const DB_PASSWORD = env.POSTGRES_PASSWORD;
export const DB_HOST = env.PGHOST;
/** Puerto de Postgres. Hasta ahora el 5432 estaba hardcodeado en tres lugares y la variable se
 * ignoraba (INF-11); ahora sale del schema de entorno. */
export const DB_PORT = env.POSTGRES_PORT;
export const PORT = env.PORT;
export const JWT_SECRET = env.JWT_SECRET;
export const ADMIN_JWT_SECRET = env.ADMIN_JWT_SECRET;
export const TOKEN_EXP = env.TOKEN_EXP;
export const ADMIN_PASS_TOKEN = env.ADMIN_PASS_TOKEN;
export const ADMIN_TOKEN_EXP = env.ADMIN_TOKEN_EXP;
export const UPLOAD_DIR = env.UPLOAD_DIR;
export const BASE_URL = env.BASE_URL;
export const ADMIN_GOOGLE_CLIENT_ID = env.ADMIN_GOOGLE_CLIENT_ID;
export const ANDROID_GOOGLE_CLIENT_ID = env.ANDROID_GOOGLE_CLIENT_ID;
export const IOS_GOOGLE_CLIENT_ID = env.IOS_GOOGLE_CLIENT_ID;
export const WEB_GOOGLE_CLIENT_ID = env.WEB_GOOGLE_CLIENT_ID;
export const ADMIN_FRONTEND_URL = env.ADMIN_FRONTEND_URL;
export const AUTHORIZED_ADMIN_EMAIL = env.AUTHORIZED_ADMIN_EMAIL;
export const RESEND_API_KEY = env.RESEND_API_KEY;
/** `false` en producción por defecto; en el resto queda prendida salvo que se apague a mano. */
export const RATE_LIMIT_ENABLED = env.RATE_LIMIT_ENABLED;
/** Nivel mínimo de log de `pino` (runtime-observability, INF-10). Default `"info"`. */
export const LOG_LEVEL = env.LOG_LEVEL;
/** DSN de Sentry. Vacío por defecto: sin valor, el SDK nunca se inicializa (D9). */
export const SENTRY_DSN = env.SENTRY_DSN;

export const INITIAL_CREDITS = 0;

/** Remitente de los mails transaccionales. En dev Resend exige su dominio de pruebas. */
export const EMAIL_FROM =
  NODE_ENV === "production" ? "Loop <noreply@loop.reditinere.com>" : "Loop <onboarding@resend.dev>";

/**
 * Si el registro exige verificar el email antes de poder entrar.
 *
 * Tener proveedor de mail y exigir verificación son dos preguntas distintas. Por defecto se deduce
 * de `RESEND_API_KEY`, porque sin proveedor el paso no se podría cumplir; pero `REQUIRE_EMAIL_
 * VERIFICATION` la responde explícitamente. Ponerla en `true` sin Resend deja el link en el log del
 * api, que es justo lo que necesitan los tests y el desarrollo local.
 */
export const REQUIRE_EMAIL_VERIFICATION = env.REQUIRE_EMAIL_VERIFICATION
  ? env.REQUIRE_EMAIL_VERIFICATION === "true"
  : !!RESEND_API_KEY;

/**
 * Si el link de verificación (con el token en cleartext) se loguea. Por default va prendido fuera
 * de producción — dev y los tests lo necesitan — y apagado en producción, donde loguearlo es una
 * fuga de una credencial de toma de cuenta (SEC-16, D17). `EMAIL_DEBUG_LINKS` permite pisar el
 * default explícitamente en cualquier sentido.
 */
export const EMAIL_DEBUG_LINKS =
  env.EMAIL_DEBUG_LINKS !== undefined
    ? env.EMAIL_DEBUG_LINKS === "true"
    : NODE_ENV !== "production";

/**
 * Si el arranque debe negarse a aceptar tráfico cuando no existe ningún `super_admin`. Apagada
 * por defecto: ver `services/bootstrapChecks.ts` para el resto del contrato (solo bloquea en
 * producción, y solo con esta bandera prendida).
 */
export const REQUIRE_SUPER_ADMIN_ON_BOOT = env.REQUIRE_SUPER_ADMIN_ON_BOOT === "true";

/** URL pública de la app, usada para armar los links de invitación. */
export const APP_BASE_URL = env.APP_BASE_URL || FRONTEND_URL || "http://localhost:8081";

/**
 * Roles de base de datos de la aplicación.
 *
 * `DB_USER` (POSTGRES_USER) es el dueño de las tablas y en la imagen oficial de Postgres es
 * SUPERUSER — y los superusuarios **ignoran Row-Level Security por completo**. Por eso la API
 * nunca se conecta con él: usa dos roles sin privilegios de superusuario.
 *
 * - `DB_APP_USER`: sujeto a RLS. Es el que atiende todo el tráfico de usuarios.
 * - `DB_UNSCOPED_USER`: tiene BYPASSRLS. Solo para los caminos que por definición no pueden estar
 *   scopeados a una comunidad (login, resolución de comunidad por dominio, panel de admin).
 *
 * Que sean dos roles distintos y no un flag es deliberado: la conexión scopeada no tiene ningún
 * SQL disponible para salirse de su comunidad.
 *
 * Las contraseñas ya no caen a `DB_PASSWORD` (SEC-01, D1): ese fallback quedaba disponible en
 * producción por accidente. `env.ts` es quien decide el default de desarrollo, y en producción no
 * hay ninguno — el proceso no arranca sin setearlas.
 */
export const DB_APP_USER = env.DB_APP_USER;
export const DB_APP_PASSWORD = env.DB_APP_PASSWORD;
export const DB_UNSCOPED_USER = env.DB_UNSCOPED_USER;
export const DB_UNSCOPED_PASSWORD = env.DB_UNSCOPED_PASSWORD;

export const ERROR_MESSAGES = {
  USER_NOT_FOUND: "Usuario no encontrado",
  USER_ALREADY_EXISTS: "El usuario ya existe",
  INVALID_CREDENTIALS: "Credenciales inválidas",
  DATABASE_ERROR: "Error al conectar a la base de datos",
  SCHOOL_NOT_FOUND: "Escuela no encontrada",
  ROLE_NOT_FOUND: "Rol no encontrado",
  DATABASE_QUERY_ERROR: "Error en la consulta a la base de datos",
  UNEXPECTED_ERROR: "Error inesperado",
  INVALID_INPUT: "Datos de entrada inválidos",
  MEDIA_NOT_FOUND: "Medios no encontrados",
  CATEGORY_NOT_FOUND: "Categoría no encontrada",
  LISTING_NOT_FOUND: "Listado no encontrado",
  MISSION_TEMPLATE_NOT_FOUND: "Plantilla de misión no encontrada",
  MISSION_NOT_FOUND: "Misión no encontrada",
  MESSAGE_NOT_FOUND: "Mensaje no encontrado",
  USER_NOT_AUTHORIZED: "Usuario no autorizado",
  INVALID_LISTING_STATUS_TO_MODIFY: "Estado de publicación inválido para modificar",
  INVALID_LISTING_STATUS_TO_OFFER: "Estado de listado inválido para hacer una oferta",
  NOT_LISTING_BUYER: "No eres el comprador de esta publicación",
  INVALID_LISTING_STATUS_TO_DELETE_OFFER: "Estado de publicación inválido para eliminar una oferta",
  NOT_LISTING_SELLER: "No eres el vendedor de esta publicación",
  INVALID_LISTING_STATUS: "Estado de publicación inválido para la acción que se quiere realizar",
  TOTAL_PRICE_EXCEEDED: "El precio total excede lo ofrecido",
  INSUFFICIENT_CREDITS: "Créditos insuficientes",
  OFFERED_CREDITS_NOT_FOUND: "Créditos ofrecidos no encontrados",
  INVALID_OFFER_PRICE: "Precio de oferta inválido",
  CANNOT_OFFER_OWN_LISTING: "No puedes hacer una oferta en tu propia publicación",
  FILE_NOT_FOUND: "Archivo no encontrado",
  INVALID_FILE_TYPE: "Tipo de archivo inválido",
  FILE_TOO_LARGE: "El archivo es demasiado grande",
  INVALID_PRICE_FOR_CATEGORY: "Precio inválido para la categoría",
  INVALID_LISTING_STATUS_TO_DELETE: "Estado de publicación inválido para eliminar",
  MISSION_KEY_ALREADY_EXISTS: "La clave de misión ya existe",
  WISH_NOT_FOUND: "Deseo no encontrado",
  EMAIL_NOT_AUTHORIZED: "El correo electrónico no está autorizado para el registro",
  GOOGLE_CREDENTIAL_INVALID: "El credential de Google es inválido",
  GOOGLE_EMAIL_NOT_VERIFIED: "El email de Google no está verificado",
  GOOGLE_ID_MISMATCH: "El ID de Google no coincide",
  INCORRECT_LOGIN_METHOD: "El método de inicio de sesión es incorrecto para este usuario",
  // Incluir palabra signup para saber que se trata de un usuario nuevo
  SCHOOL_IDS_REQUIRED_FOR_GOOGLE_SIGNUP: "signup requiere schoolIds",
  TOKEN_GENERATION_FAILED: "Error al generar el token de autenticación",
  COMMUNITY_NOT_FOUND: "Comunidad no encontrada",
  COMMUNITY_REQUIRED: "Se requiere indicar una comunidad",
  COMMUNITY_INACTIVE: "La comunidad no está activa",
  SCHOOLS_NOT_IN_COMMUNITY: "Los colegios seleccionados no pertenecen a tu comunidad",
  COMMUNITY_SLUG_ALREADY_EXISTS: "Ya existe una comunidad con ese identificador",
  DOMAIN_ALREADY_TAKEN: "Ese dominio ya pertenece a otra comunidad",
  CANNOT_CHANGE_COMMUNITY: "No se puede cambiar la comunidad de una cuenta",
  CANNOT_MOVE_USER_WITH_CONTENT:
    "No se puede mover de comunidad a un usuario que ya tiene actividad",
  SUPER_ADMIN_REQUIRED: "Se requieren permisos de super administrador",
  INVITATION_INVALID: "La invitación no es válida",
  INVITATION_ALREADY_USED: "Esta invitación ya fue utilizada",
  DELETE_REQUEST_INVALID: "El enlace de borrado no es válido o expiró",
  EMAIL_NOT_VERIFIED: "Tu email no fue verificado. Revisá tu bandeja de entrada.",
  EMAIL_VERIFICATION_TOKEN_INVALID: "El enlace de verificación no es válido o ya fue usado",
  EMAIL_VERIFICATION_SENT: "Si el email está registrado, revisá tu bandeja de entrada.",
  // ─── credit-economy-integrity (ECO-05/ECO-10) — agregados al final, sin tocar los existentes ──
  NOT_LISTING_PARTY: "No sos parte de este loop",
  INVALID_LISTING_STATUS_TO_CANCEL: "Estado de publicación inválido para cancelar",
  MEDIA_NOT_OWNED: "Uno de los archivos adjuntos no te pertenece",
  DONATION_BELOW_MINIMUM: "El monto donado es menor al mínimo permitido",
  DONATION_ABOVE_MAXIMUM: "El monto donado supera el máximo permitido",
  DONATION_DAILY_CAP_EXCEEDED: "Superaste el límite diario de donaciones",
  CANNOT_DONATE_TO_SELF: "No podés donarte créditos a vos mismo",
  TOO_MANY_TRADING_LISTINGS: "Se ofrecieron demasiadas publicaciones en la parte de pago",
  DUPLICATE_TRADING_LISTINGS:
    "Una misma publicación no puede ofrecerse dos veces en la misma oferta",
  // ─── legal-public-routes (SEC-11) — agregados al final, sin tocar los existentes ───────────────
  PASSWORD_RESET_TOKEN_INVALID: "El enlace de reseteo no es válido, ya fue usado o expiró",
  PASSWORD_RESET_SENT: "Si el email está registrado, revisá tu bandeja de entrada.",
};

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
export const adminCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 60 * 1000, // 30 minutos
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};
export const COOKIE_NAMES = {
  TOKEN: "token",
  ADMIN_TOKEN: "admin_token",
};
export const PAGE_SIZE = 10;

// TODO - Terminar de agregar dominios válidos
export const VALID_EMAIL_DOMAINS = [
  "northfield.edu.ar",
  // "gmail.com",
  "reditinere.com",
  "colegiodelfaro.edu.ar",
  "southcreekschool.com.ar",
  "northschools.uy",
  "theglobalschool.com.ar",
];

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
export const IMAGE_MAX_WIDTH = 1280;
export const IMAGE_MAX_HEIGHT = 1280;
export const IMAGE_QUALITY = 72;

export const NOTIFICATION_TEXTS = {
  MISSION_NOTIFICATION: {
    COMPLETED: {
      body: "¡Has completado una misión y ganado créditos!",
      title: "Misión completada",
    },
  },
  LOOP_NOTIFICATION: {
    listing_cancelled: {
      body: "Una publicación que esperabas recibir fue cancelada",
      title: "Publicación cancelada",
    },
    listing_received: {
      body: "Has completado correctamente un loop",
      title: "Loop completado",
    },
    new_offer: {
      body: "Has recibido una nueva oferta en tu publicación",
      title: "Nueva oferta",
    },
    offer_accepted: {
      body: "Tu oferta ha sido aceptada",
      title: "Oferta aceptada",
    },
    offer_rejected: {
      body: "Tu oferta ha sido rechazada",
      title: "Oferta rechazada",
    },
    offer_deleted: {
      body: "Una oferta que habías recibido fue eliminada",
      title: "Oferta eliminada",
    },
    listing_sold: {
      body: "Una de tus publicaciones se entregó como parte de un intercambio",
      title: "Publicación entregada",
    },
  } satisfies Record<LoopNotificationPayload["type"], { body: string; title: string }>,
  DONATION_NOTIFICATION: {
    RECEIVED: {
      body: "Has recibido una donación de loopies",
      title: "Donación recibida",
    },
  },
  // ADMIN_NOTIFICATION: {
  //   ""
  // } as Record<
  //   AdminNotificationPayload["action"],
  //   { body: string; title: string }
  // >,
};

export const MISSION_KEYS = {
  PUBLISH_LISTING_1: "publish-listing-1",
  PUBLISH_LISTING_2: "publish-listing-2",
  PUBLISH_LISTING_3: "publish-listing-3",
  UPDATE_PROFILE_IMAGE: "update-profile-image",
};

export const NOTIFICATIONS_CATEGORIES = {
  MISSION: "mission",
  LOOP: "loop",
  DONATION: "donation",
  ADMIN: "admin",
  MESSAGE: "message",
};

/**
 * Signed media URLs (SEC-08, `legal-public-routes` design D7).
 *
 * Read directly from `process.env`, not through `env.ts`'s Zod schema — registering these in
 * that schema belongs to `sec-hardening-api` (proposal, "Environment / operational"); declaring
 * and defaulting them is this block's job. Default is signing **off**: `parseMediaFromDb` and
 * `routes/uploads.ts` both no-op to today's unsigned behaviour until this is flipped on, per the
 * verify-then-enable ordering in `openspec/changes/legal-public-routes/tasks.md` phase 4.
 */
export const MEDIA_URL_SIGNING_ENABLED = process.env.MEDIA_URL_SIGNING_ENABLED === "true";
export const MEDIA_SIGNING_SECRET = process.env.MEDIA_SIGNING_SECRET || "";
/** Accepted during secret rotation so URLs signed with the outgoing secret keep verifying. */
export const MEDIA_SIGNING_SECRET_PREVIOUS = process.env.MEDIA_SIGNING_SECRET_PREVIOUS || "";
/** How long a signed URL stays valid after its bucket window opens. Default 24h. */
export const MEDIA_URL_TTL_SECONDS = Number(process.env.MEDIA_URL_TTL_SECONDS) || 86400;
/** Bucket width for `exp`, so the same file gets a byte-identical URL within a window (caching). */
export const MEDIA_URL_BUCKET_SECONDS = Number(process.env.MEDIA_URL_BUCKET_SECONDS) || 3600;

/**
 * Límites de donación (credit-ledger: "Donation Limits", ECO-10, design D12).
 *
 * Constantes de configuración, no columnas: por decisión de producto quedan iguales para todas las
 * comunidades (PROD-02, configuración por comunidad, queda fuera de alcance). El tope diario se
 * calcula sumando las filas `donation_sent` de hoy en el ledger — una consulta que solo es posible
 * porque ECO-02 finalmente escribe esas filas.
 */
export const DONATION_MIN_CREDITS = Number(process.env.DONATION_MIN_CREDITS) || 1;
export const DONATION_MAX_CREDITS = Number(process.env.DONATION_MAX_CREDITS) || 100000;
export const DONATION_DAILY_MAX_CREDITS = Number(process.env.DONATION_DAILY_MAX_CREDITS) || 200000;

/** Cota superior de créditos representable (`credits_balance`/`credits_locked` son BIGINT, pero
 * mantenerla razonable evita que un input malicioso intente mover cifras astronómicas). */
export const MAX_CREDITS = 1_000_000_000;

/** Cardinalidad máxima de `tradingListingIds` en una aceptación (listing-lifecycle: "Validated And
 * Persisted Trades"). Antes no tenía ningún tope. */
export const MAX_TRADE_LISTINGS = 20;
