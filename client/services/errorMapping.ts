import { VALID_EMAIL_DOMAINS } from "@/config";

const ALLOWED_DOMAINS_TEXT = VALID_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(", ");

const ERROR_CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Revisa los datos ingresados e inténtalo de nuevo.",
  INVALID_INPUT: "Revisa los datos ingresados e inténtalo de nuevo.",
  CONFLICT: "El recurso ya existe.",
  UNAUTHORIZED: "No tienes autorización para realizar esta acción.",
  NOT_FOUND: "El recurso solicitado no fue encontrado.",
  INTERNAL_ERROR: "Ocurrió un error interno. Inténtalo más tarde.",
  USER_ALREADY_EXISTS: "El correo electrónico ya está registrado.",
  USER_NOT_FOUND: "No encontramos una cuenta con ese correo electrónico.",
  INVALID_CREDENTIALS: "Correo electrónico o contraseña incorrectos.",
  INCORRECT_LOGIN_METHOD: "Este usuario no puede iniciar sesión con este método. Prueba con Google.",
  EMAIL_NOT_AUTHORIZED: `Tu correo no pertenece a un dominio permitido. Dominios válidos: ${ALLOWED_DOMAINS_TEXT}`,
  GOOGLE_CREDENTIAL_INVALID: "No se pudo verificar tu cuenta de Google. Inténtalo de nuevo.",
  GOOGLE_EMAIL_NOT_VERIFIED: "Tu correo de Google no está verificado. Verifícalo e inténtalo de nuevo.",
  GOOGLE_ID_MISMATCH: "No se pudo vincular tu cuenta de Google. Contacta con soporte.",
  SCHOOL_IDS_REQUIRED: "Debes seleccionar al menos una escuela para continuar.",
  TOKEN_GENERATION_FAILED: "Error al iniciar sesión. Inténtalo de nuevo.",
  DATABASE_ERROR: "Error de conexión. Inténtalo más tarde.",
  FILE_TOO_LARGE: "El archivo es demasiado grande.",
  UNEXPECTED_ERROR: "Ocurrió un error inesperado. Inténtalo más tarde.",
};

const GENERIC_AXIOS_MESSAGES = [
  "request failed with status code",
  "network error",
];

const isGenericAxiosMessage = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return GENERIC_AXIOS_MESSAGES.some((pattern) => lower.includes(pattern));
};

export const getUserFriendlyErrorMessage = (error: unknown): string => {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    const message = typeof err.message === "string" ? err.message : undefined;

    if (message && !isGenericAxiosMessage(message)) {
      return message;
    }

    if (err.errorCode && typeof err.errorCode === "string") {
      const mapped = ERROR_CODE_MESSAGES[err.errorCode];
      if (mapped) return mapped;
    }

    if (message) {
      return message;
    }

    if (err.error && typeof err.error === "string") {
      return err.error;
    }
  }

  return "Ocurrió un error inesperado.";
};

export const isNetworkError = (error: unknown): boolean => {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: string }).message.toLowerCase();
    return (
      msg.includes("network error") ||
      msg.includes("timeout") ||
      msg.includes("abort") ||
      msg.includes("connection")
    );
  }
  return false;
};
