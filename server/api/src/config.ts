import dotenv from "dotenv";
dotenv.config({
  path: [".env", "../.env", "*/.env"],
});

export const {
  NODE_ENV,
  POSTGRES_USER: DB_USER,
  POSTGRES_DB: DB_NAME,
  POSTGRES_PASSWORD: DB_PASSWORD,
  PORT = 3000,
  JWT_SECRET,
  TOKEN_EXP = 30 * 24 * 60 * 60, // 30 días
  ADMIN_PASS_TOKEN,
  ADMIN_TOKEN_EXP = 30 * 60, // 30 minutos
  UPLOAD_DIR = "/uploads",
  BASE_URL = "http://localhost:3000",
} = process.env;
export const INITIAL_CREDITS = 0;

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
  INVALID_LISTING_STATUS_TO_MODIFY:
    "Estado de publicación inválido para modificar",
  INVALID_LISTING_STATUS_TO_OFFER:
    "Estado de listado inválido para hacer una oferta",
  NOT_LISTING_BUYER: "No eres el comprador de esta publicación",
  INVALID_LISTING_STATUS_TO_DELETE_OFFER:
    "Estado de publicación inválido para eliminar una oferta",
  NOT_LISTING_SELLER: "No eres el vendedor de esta publicación",
  INVALID_LISTING_STATUS:
    "Estado de publicación inválido para la acción que se quiere realizar",
  TOTAL_PRICE_EXCEEDED: "El precio total excede lo ofrecido",
  INSUFFICIENT_CREDITS: "Créditos insuficientes",
  OFFERED_CREDITS_NOT_FOUND: "Créditos ofrecidos no encontrados",
  INVALID_OFFER_PRICE: "Precio de oferta inválido",
  CANNOT_OFFER_OWN_LISTING:
    "No puedes hacer una oferta en tu propia publicación",
  FILE_NOT_FOUND: "Archivo no encontrado",
  INVALID_FILE_TYPE: "Tipo de archivo inválido",
  FILE_TOO_LARGE: "El archivo es demasiado grande",
  INVALID_PRICE_FOR_CATEGORY: "Precio inválido para la categoría",
  INVALID_LISTING_STATUS_TO_DELETE:
    "Estado de publicación inválido para eliminar",
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
};
export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 60 * 1000, // 30 minutos
};
export const COOKIE_NAMES = {
  TOKEN: "token",
  ADMIN_TOKEN: "admin_token",
};
export const PAGE_SIZE = 10;

export const VALID_EMAIL_DOMAINS = ["northfield.edu.ar", "gmail.com"];
