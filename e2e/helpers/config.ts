/**
 * Centraliza el acceso a variables de entorno de los E2E de Loop.
 *
 * En Docker (docker-compose.e2e.yml) estos valores los setea el compose; localmente
 * se pueden sobreescribir por variable de entorno para correr contra un dev server.
 */
export const ENV = {
  API_URL: process.env.API_URL || "http://localhost:3000",

  PGHOST: process.env.PGHOST || "localhost",
  POSTGRES_PORT: Number(process.env.POSTGRES_PORT || 5432),
  POSTGRES_USER: process.env.POSTGRES_USER || "postgres",
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "password",
  POSTGRES_DB: process.env.POSTGRES_DB || "db",
} as const;

/** Dominios válidos de la comunidad sembrada por migration 0001 (`red-itinere`). */
export const RED_ITINERE_DOMAINS = [
  "northfield.edu.ar",
  "reditinere.com",
  "colegiodelfaro.edu.ar",
  "southcreekschool.com.ar",
  "northschools.uy",
  "theglobalschool.com.ar",
] as const;