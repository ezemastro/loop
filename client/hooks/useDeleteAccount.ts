import { api } from "@/api/loop";
import { ApiError, parseErrorName } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

const fetchDeleteAccount = async () => {
  try {
    const response = await api.delete<DeleteSelfResponse>(`/me`);
    if (!response.data.success) {
      throw new Error(response.data.error || "Error desconocido");
    }
    return response.data;
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

export const useDeleteAccount = () => {
  const logout = useSessionStore((state) => state.logout);

  return useMutation({
    mutationFn: fetchDeleteAccount,
    onSuccess: () => {
      logout();
    },
  });
};
