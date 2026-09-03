import { api } from "@/api/loop";
import { parseApiError } from "@/services/errors";
import { useSessionHydrated, useSessionStore } from "@/stores/session";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const fetchSelf = async () => {
  try {
    const response = await api.get<GetSelfResponse>(`/me`);
    return response.data.data;
  } catch (error) {
    throw parseApiError(error);
  }
};

export const useSelf = () => {
  /**
   * `zustand/persist` rehydrates asynchronously on every platform (SecureStore on native,
   * AsyncStorage/localStorage on web), so on a cold start the first render has `authToken === null`
   * even for a signed-in user. Firing `/me` in that window sends no `Authorization` header, the API
   * answers 401, and the session is wiped — the user reloads the web app and lands back on `/`
   * logged out. Waiting one turn for the store costs nothing and removes the race entirely.
   */
  const hydrated = useSessionHydrated();
  const query = useQuery({
    queryKey: ["self"],
    queryFn: () => fetchSelf(),
    enabled: hydrated,
  });
  const setUser = useSessionStore((state) => state.setUser);
  // Actualizar el usuario en el store cuando se obtiene la data
  useEffect(() => {
    if (query.data) {
      setUser(query.data.user);
    }
  }, [query.data, setUser]);

  // Expiry logout is NOT handled here. The axios response interceptor owns it through
  // `shouldLogout`, which only closes the session when the failed request actually carried the
  // stored token. The copy that used to live here fired on *any* 401 — including a tokenless one —
  // which is precisely how a pre-hydration `/me` turned into a logout.
  return query;
};
