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

export const {
  NODE_ENV,
  FRONTEND_URL,
  POSTGRES_USER: DB_USER,
  POSTGRES_DB: DB_NAME,
  POSTGRES_PASSWORD: DB_PASSWORD,
  PGHOST: DB_HOST = "db",
  PORT = 3000,
  JWT_SECRET = "jwt_secret_dev",
  TOKEN_EXP = 30 * 24 * 60 * 60, // 30 días
  ADMIN_PASS_TOKEN,
  ADMIN_TOKEN_EXP = 30 * 60, // 30 minutos
  UPLOAD_DIR = "/uploads",
  BASE_URL = "http://localhost:3000",
  ADMIN_GOOGLE_CLIENT_ID,
  ANDROID_GOOGLE_CLIENT_ID,
  IOS_GOOGLE_CLIENT_ID,
  WEB_GOOGLE_CLIENT_ID,
  ADMIN_FRONTEND_URL,
  AUTHORIZED_ADMIN_EMAIL,
} = process.env;
export const INITIAL_CREDITS = 0;

/** URL pública de la app, usada para armar los links de invitación. */
export const APP_BASE_URL = process.env.APP_BASE_URL || FRONTEND_URL || "http://localhost:8081";

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
 */
export const DB_APP_USER = process.env.DB_APP_USER || "loop_app";
export const DB_APP_PASSWORD = process.env.DB_APP_PASSWORD || DB_PASSWORD || "loop_app_dev";
export const DB_UNSCOPED_USER = process.env.DB_UNSCOPED_USER || "loop_app_unscoped";
export const DB_UNSCOPED_PASSWORD =
  process.env.DB_UNSCOPED_PASSWORD || DB_PASSWORD || "loop_unscoped_dev";

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
  } as Record<LoopNotificationPayload["type"], { body: string; title: string }>,
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
