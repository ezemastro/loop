export const successResponse = ({
  data,
  pagination,
}: {
  data?: unknown;
  pagination?: unknown;
} = {}) => {
  if (pagination) {
    return {
      success: true,
      data,
      pagination,
    };
  }
  return {
    success: true,
    data,
  };
};

export const errorResponse = (error: unknown) => {
  return {
    success: false,
    error,
  };
};
