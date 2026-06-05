import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useMutation } from "@tanstack/react-query";

const fetchDeleteAccount = async () => {
  try {
    const response = await api.delete<DeleteSelfResponse>(`/me`);
    if (!response.data.success) {
      throw { message: response.data.error || "Error desconocido", errorCode: response.data.errorCode };
    }
    return response.data;
  } catch (err) {
    throw parseApiError(err);
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
