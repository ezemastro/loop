export const ERROR_NAMES = {
  INVALID_INPUT: "InvalidInputError",
  CONFLICT: "ConflictError",
  UNAUTHORIZED: "UnauthorizedError",
  INTERNAL_SERVER: "InternalServerError",
};

export const parseErrorName = ({ status }: { status: number }) => {
  if (status === 400) return ERROR_NAMES.INVALID_INPUT;
  if (status === 409) return ERROR_NAMES.CONFLICT;
  if (status === 401) return ERROR_NAMES.UNAUTHORIZED;
  return ERROR_NAMES.INTERNAL_SERVER;
};

export interface ApiError {
  name: string;
  message: string;
  errorCode?: string;
  /**
   * Cuerpo `data` de la respuesta de error. Algunos códigos traen contexto útil: por ejemplo
   * `SCHOOL_IDS_REQUIRED` viene con la comunidad ya resuelta por el servidor.
   */
  data?: unknown;
}

const tryParseJson = (data: unknown): Record<string, unknown> | null => {
  if (!data) return null;
  if (typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // no es JSON
    }
  }
  return null;
};

const extractServerError = (data: unknown): { message?: string; errorCode?: string } | null => {
  const obj = tryParseJson(data);
  if (!obj) return null;
  const error = typeof obj.error === "string" && obj.error ? obj.error : undefined;
  const message = typeof obj.message === "string" && obj.message ? obj.message : undefined;
  const errorCode = typeof obj.errorCode === "string" && obj.errorCode ? obj.errorCode : undefined;
  const serverMessage = error || message;
  return serverMessage || errorCode ? { message: serverMessage, errorCode } : null;
};

const isGenericAxiosMessage = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return lower.includes("request failed with status code") || lower.includes("network error");
};

export const parseApiError = (error: unknown): ApiError => {
  if (
    error &&
    typeof error === "object" &&
    "isAxiosError" in error &&
    (error as any).isAxiosError
  ) {
    const err = error as any;
    const status = err.response?.status || 500;
    const server = extractServerError(err.response?.data);

    const message =
      (server?.message && !isGenericAxiosMessage(server.message) ? server.message : undefined) ||
      err.message ||
      "Error desconocido";

    return {
      name: parseErrorName({ status }),
      message,
      errorCode: server?.errorCode || undefined,
      data: tryParseJson(err.response?.data)?.data,
    };
  }

  if (error && typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const err = error as Record<string, unknown>;
    const server = extractServerError(err);
    return {
      name: "Error",
      message: server?.message || String(err.message),
      errorCode:
        server?.errorCode || (typeof err.errorCode === "string" ? err.errorCode : undefined),
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: error };
  }

  return {
    name: ERROR_NAMES.INTERNAL_SERVER,
    message: "Error desconocido",
  };
};
