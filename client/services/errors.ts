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

export const parseApiError = (error: unknown): ApiError => {
  if (
    error &&
    typeof error === "object" &&
    "isAxiosError" in error &&
    (error as any).isAxiosError
  ) {
    const err = error as any;
    const status = err.response?.status || 500;

    return {
      name: parseErrorName({ status }),
      message: err.response?.data?.error || err.message || "Error desconocido",
      errorCode: err.response?.data?.errorCode || undefined,
    };
  }

  if (error instanceof Error) {
    return {
      name: "Error",
      message: error.message,
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
