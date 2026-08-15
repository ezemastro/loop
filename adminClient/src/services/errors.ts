import { AxiosError } from "axios";

/**
 * Traducción de los `errorCode` del backend. Se prefiere el código sobre el `error` textual porque
 * el texto de la API está pensado para desarrolladores, no para el admin que está usando el panel.
 */
const ERROR_MESSAGES: Record<string, string> = {
  COMMUNITY_SLUG_ALREADY_EXISTS: "Ya existe una comunidad con ese identificador (slug).",
  DOMAIN_ALREADY_TAKEN: "Ese dominio ya pertenece a otra comunidad.",
  SUPER_ADMIN_REQUIRED: "Solo un super administrador puede hacer esto.",
  COMMUNITY_REQUIRED: "Hay que elegir una comunidad para esta acción.",
  CANNOT_MOVE_USER_WITH_CONTENT:
    "No se puede mover al usuario: ya tiene contenido en su comunidad actual.",
  SCHOOLS_NOT_IN_COMMUNITY: "Alguno de los colegios elegidos no pertenece a esa comunidad.",
};

/** Código de error de la API, si la respuesta lo trae. */
export const getErrorCode = (err: unknown): string | undefined => {
  if (!(err instanceof AxiosError)) return undefined;
  const data = err.response?.data as ApiResponseError | undefined;
  return data?.errorCode;
};

/**
 * Mensaje listo para mostrar. Orden: código conocido → texto de la API → texto de respaldo.
 */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiResponseError | undefined;
    const code = data?.errorCode;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    if (data?.error) return data.error;
  }
  return fallback;
};
