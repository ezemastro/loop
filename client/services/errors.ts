export const ERROR_NAMES = {
  INVALID_INPUT: "InvalidInputError",
  CONFLICT: "ConflictError",
  UNAUTHORIZED: "UnauthorizedError",
  INTERNAL_SERVER: "InternalServerError",
};

export const parseErrorName = ({ status }: { status: number }) => {
  let errName;
  if (status === 400) {
    errName = ERROR_NAMES.INVALID_INPUT;
  } else if (status === 409) {
    errName = ERROR_NAMES.CONFLICT;
  } else if (status === 401) {
    errName = ERROR_NAMES.UNAUTHORIZED;
  } else {
    errName = ERROR_NAMES.INTERNAL_SERVER;
  }
  return errName;
};

export interface ApiError {
  name: string;
  message: string;
  errorCode?: string;
}

const extractServerMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string" && d.error) return d.error;
  if (typeof d.message === "string" && d.message) return d.message;
  return undefined;
};

const extractServerErrorCode = (data: unknown): string | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.errorCode === "string" && d.errorCode) return d.errorCode;
  return undefined;
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
    const serverMessage = extractServerMessage(err.response?.data);

    return {
      name: parseErrorName({ status }),
      message: serverMessage || err.message || "Error desconocido",
      errorCode: extractServerErrorCode(err.response?.data) || undefined,
    };
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in (error as Record<string, unknown>)
  ) {
    const err = error as Record<string, unknown>;
    return {
      name: "Error",
      message: String(err.message),
      errorCode: typeof err.errorCode === "string" ? err.errorCode : undefined,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }

  return {
    name: ERROR_NAMES.INTERNAL_SERVER,
    message: "Error desconocido",
  };
};
