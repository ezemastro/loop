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
}
