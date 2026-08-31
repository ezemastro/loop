import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useMutation } from "@tanstack/react-query";

const fetchResendVerification = async (body: PostAuthResendVerificationRequest["body"]) => {
  try {
    const response = await api.post<PostAuthResendVerificationResponse>(
      "/auth/resend-verification",
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

export const useResendVerification = () => {
  return useMutation({
    mutationFn: fetchResendVerification,
  });
};
