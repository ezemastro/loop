import { api } from "@/api/loop";
import { ERROR_NAMES, parseErrorName } from "@/services/errors";
import { useSessionStore } from "@/stores/session";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useEffect } from "react";

const fetchSelf = async () => {
  try {
    const response = await api.get<GetSelfResponse>(`/me`);
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw {
        name: parseErrorName({ status: error.response?.status || 500 }),
        message: error.message,
      };
    }
  }
};

export const useSelf = () => {
  const query = useQuery({
    queryKey: ["self"],
    queryFn: () => fetchSelf(),
  });
  const setUser = useSessionStore((state) => state.setUser);
  const logout = useSessionStore((state) => state.logout);
  // Actualizar el usuario en el store cuando se obtiene la data
  useEffect(() => {
    if (query.data) {
      setUser(query.data.user);
    }
  }, [query.data, setUser]);
  // Logout si el token es invalido o ha expirado
  useEffect(() => {
    if (query.error?.name === ERROR_NAMES.UNAUTHORIZED) {
      logout();
    }
  }, [query.error, logout]);

  return query;
};
