import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchRegisterToken = async (
  body: PostSelfNotificationTokenRequest["body"],
) => {
  try {
    const response = await api.post<PostSelfNotificationTokenResponse>(
      "/me/notification-token",
      body,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Error desconocido");
    }
    return response.data.data;
  } catch (err) {
    console.log(err);
    if (err instanceof AxiosError) {
      const errName = parseErrorName({ status: err.response?.status || 500 });
      throw {
        name: errName,
        message: err.message,
      } as ApiError;
    }
    throw err;
  }
};

export const useRegisterPushToken = () => {
  const setHasToken = useSessionStore((state) => state.setHasToken);
  const hasToken = useSessionStore((state) => state.hasToken);

  return useMutation({
    mutationFn: (body: PostSelfNotificationTokenRequest["body"]) => {
      if (hasToken) {
        return Promise.resolve();
      }
      return fetchRegisterToken(body);
    },
    onSuccess: () => {
      if (!hasToken) {
        setHasToken(true);
      }
    },
  });
};
