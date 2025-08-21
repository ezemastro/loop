export const successResponse = (data: unknown) => {
  return {
    status: "success",
    data,
  };
};

export const errorResponse = (error: unknown) => {
  return {
    status: "error",
    error,
  };
};
