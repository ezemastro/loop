import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchForgotPassword = async (body: PostAuthForgotPasswordRequest["body"]) => {
  try {
    const response = await api.post<PostAuthForgotPasswordResponse>(
      "/auth/forgot-password",
      body,
    );
    if (!response.data.success) {
      throw { message: response.data.error, errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

/**
 * Always resolves with the same shape whether or not the account exists — the API is
 * deliberately indistinguishable (spec `password-reset`, "Unknown address is indistinguishable").
 * The UI must not read anything into success beyond "the request was accepted".
 */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: fetchForgotPassword,
  });
};
