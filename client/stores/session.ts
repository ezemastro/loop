import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "@/api/queryClient";
import { useThemeStore } from "@/stores/theme";

interface SessionStore {
  user: PrivateUser | null;
  authToken: string | null;
  hasAcceptedTerms: boolean;
  login: (user: PrivateUser, token?: string) => void;
  logout: () => void;
  setUser: (user: PrivateUser) => void;
  setAuthToken: (token: string | null) => void;
  setHasAcceptedTerms: (accepted: boolean) => void;
  hasToken: boolean;
  setHasToken: (hasToken: boolean) => void;
}

/**
 * Engancha el tema a la sesión desde acá y no desde cada hook (login, registro, Google, `/me`):
 * todos terminan en `login`/`setUser`, así que es el único punto donde no se puede olvidar.
 * El `if` cubre sesiones viejas persistidas de antes de las comunidades.
 */
const syncCommunityTheme = (user: PrivateUser) => {
  if (user?.community) useThemeStore.getState().setCommunity(user.community);
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      user: null,
      authToken: null,
      login: (user, token) => {
        set((state) => ({
          user,
          authToken: token ?? state.authToken,
        }));
        syncCommunityTheme(user);
      },
      logout: () => {
        set({
          user: null,
          authToken: null,
          hasAcceptedTerms: false,
          hasToken: false,
        });
        // En un dispositivo compartido el siguiente en entrar puede ser de otra comunidad: si el
        // tema no se limpia ve los colores del anterior, y si la caché no se limpia ve por un
        // frame sus listings.
        useThemeStore.getState().clear();
        queryClient.clear();
      },
      setUser: (user) => {
        set({ user });
        syncCommunityTheme(user);
      },
      setAuthToken: (token) => set({ authToken: token }),
      hasAcceptedTerms: false,
      setHasAcceptedTerms: (accepted: boolean) => set({ hasAcceptedTerms: accepted }),
      hasToken: false,
      setHasToken: (hasToken: boolean) => set({ hasToken }),
    }),
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
