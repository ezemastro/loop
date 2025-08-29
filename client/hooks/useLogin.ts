import { api } from "@/api/loop";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";

const fetchLogin = async (body: PostAuthRegisterRequest["body"]) => {
  const response = await api.post<PostAuthLoginResponse>("/auth/login", body);

  if (!response.data.success) {
    throw new Error("Error al iniciar sesión");
  }
  return response.data.data;
};

export const useLogin = () => {
  const login = useSessionStore((state) => state.login);

  return useMutation({
    mutationFn: fetchLogin,
    onSuccess: ({ user }) => {
      login(user);
    },
  });
};
