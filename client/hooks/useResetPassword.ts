import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchResetPassword = async (body: PostAuthResetPasswordRequest["body"]) => {
  try {
    const response = await api.post<PostAuthResetPasswordResponse>("/auth/reset-password", body);
    if (!response.data.success) {
      throw { message: response.data.error, errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: fetchResetPassword,
  });
};
