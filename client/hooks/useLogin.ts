import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";

const fetchLogin = async (body: PostAuthLoginRequest["body"]) => {
  try {
    const response = await api.post<PostAuthLoginResponse>("/auth/login", body);

    if (!response.data.success) {
      throw { message: response.data.error, errorCode: response.data.errorCode };
    }
    return response.data.data;
  } catch (err) {
    throw parseApiError(err);
  }
};

export const useLogin = () => {
  const login = useSessionStore((state) => state.login);

  return useMutation({
    mutationFn: fetchLogin,
    onSuccess: (result) => {
      login(result!.user, result!.token);
    },
  });
};
