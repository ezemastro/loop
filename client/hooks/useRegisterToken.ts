import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";

const fetchRegisterToken = async (body: PostSelfNotificationTokenRequest["body"]) => {
  try {
    const response = await api.post<PostSelfNotificationTokenResponse>(
      "/me/notification-token",
      body,
    );

    if (response.status === 204) {
      return undefined;
    }

    if (response.data && !response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
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
