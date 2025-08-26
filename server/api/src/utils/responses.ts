export const successResponse = ({
  data,
  pagination,
}: {
  data: unknown;
  pagination?: unknown;
}) => {
  if (pagination) {
    return {
      status: "success",
      data,
      pagination,
    };
  }
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
