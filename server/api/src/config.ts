import dotenv from "dotenv";
dotenv.config({
  path: [".env", "../.env"],
});

export const {
  POSTGRES_USER: DB_USER,
  POSTGRES_DB: DB_NAME,
  POSTGRES_PASSWORD: DB_PASSWORD,
  PORT = 3000,
  JWT_SECRET,
  TOKEN_EXP = "30d",
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
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
};
export const COOKIE_NAMES = {
  TOKEN: "token",
};
