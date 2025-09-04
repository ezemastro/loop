import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchLogin = async (body: PostAuthLoginRequest["body"]) => {
  try {
    const response = await api.post<PostAuthLoginResponse>("/auth/login", body);

    if (!response.data.success) {
      throw new Error(response.data.error || "Error desconocido");
    }
    return response.data.data;
  } catch (err) {
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

export const useLogin = () => {
  const login = useSessionStore((state) => state.login);

  return useMutation({
    mutationFn: fetchLogin,
    onSuccess: (result) => {
      login(result!.user);
    },
  });
};
