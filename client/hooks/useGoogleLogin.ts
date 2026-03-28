import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchGoogleLogin = async (body: PostAuthGoogleLoginRequest["body"]) => {
  try {
    const response = await api.post<PostAuthGoogleLoginResponse>(
      "/auth/google-login",
      body,
    );

    if (!response.data.success) {
      throw new Error(response.data.error || "Error desconocido");
    }
    return response.data.data;
  } catch (err) {
    console.log("Error en fetchGoogleLogin:", err);
    if (err instanceof AxiosError) {
      const errName = parseErrorName({ status: err.response?.status || 500 });
      const errorMessage = 
        err.response?.data?.error || 
        err.response?.data?.message || 
        err.message || 
        "Error al iniciar sesión con Google";
      throw {
        name: errName,
        message: errorMessage,
      } as ApiError;
    }
    throw err;
  }
};

export const useGoogleLogin = () => {
  const login = useSessionStore((state) => state.login);

  return useMutation({
    mutationFn: fetchGoogleLogin,
    onSuccess: (result) => {
      login(result!.user, result!.token);
    },
  });
};
