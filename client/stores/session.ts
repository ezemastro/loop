import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { queryClient } from "@/api/queryClient";
import { useThemeStore } from "@/stores/theme";
import { disableDemoMode, enableDemoMode } from "@/demo";
import { sessionStorage } from "@/services/secureStorage";
import { TERMS_VERSION } from "@/content/legal/termsDocument";

/**
 * The server row is the source of truth once a `user` exists (design D5): a fresh `login`/
 * `setUser` always recomputes this from `user.termsVersion`, so acceptance survives logout
 * (proposal C6) and a `TERMS_VERSION` bump re-prompts every user without any migration. The
 * persisted local flag only matters in the narrow window covered by `setHasAcceptedTerms`
 * directly — the "acceptance POST failed, don't lock the user out this session" fallback (spec
 * `terms-acceptance`, "Acceptance Failure Must Not Lock Users Out").
 */
const deriveHasAcceptedTerms = (user: PrivateUser): boolean => user.termsVersion === TERMS_VERSION;

interface SessionStore {
  user: PrivateUser | null;
  authToken: string | null;
  hasAcceptedTerms: boolean;
  /**
   * Modo demo activo **en este dispositivo**. Vive acá y no en su propio store por una razón
   * concreta: se persiste junto al token, así que rehidratan a la vez. Si estuvieran separados
   * podría existir un instante con el token de la demo ya cargado y el modo todavía apagado, y en
   * ese instante las requests saldrían a la API real.
   */
  demoMode: boolean;
  login: (user: PrivateUser, token?: string) => void;
  /** Enciende el modo demo en este dispositivo. El login posterior lo resuelve el mock. */
  enterDemoMode: () => void;
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
      demoMode: false,
      enterDemoMode: () => {
        // Reinicia la base simulada: cada entrada a la demo arranca limpia, sin heredar lo que
        // haya tocado quien usó el dispositivo antes.
        enableDemoMode();
        // Y la caché de queries y el tema, por el mismo motivo que en `logout`: lo que quedó de la
        // API real no tiene nada que hacer dentro de la demo. El tema importa más de lo que parece:
        // el logo de una comunidad real es una ruta *relativa*, y renderizarlo dispararía un GET
        // contra la API real desde un `<Image>`, por fuera de axios y del adaptador.
        queryClient.clear();
        useThemeStore.getState().clear();
        set({ demoMode: true });
      },
      login: (user, token) => {
        set((state) => ({
          user,
          authToken: token ?? state.authToken,
          hasAcceptedTerms: deriveHasAcceptedTerms(user),
        }));
        syncCommunityTheme(user);
      },
      logout: () => {
        set({
          user: null,
          authToken: null,
          hasAcceptedTerms: false,
          hasToken: false,
          demoMode: false,
        });
        // En un dispositivo compartido el siguiente en entrar puede ser de otra comunidad: si el
        // tema no se limpia ve los colores del anterior, y si la caché no se limpia ve por un
        // frame sus listings.
        useThemeStore.getState().clear();
        queryClient.clear();
        // Apagar la demo va **último**, y el orden es la parte importante: apagarla reabre la red,
        // así que hacerlo antes de limpiar dejaría una ventana con el estado de la sesión simulada
        // todavía vivo y el adaptador ya delegando en la API real. Acá no queda nada que filtrar.
        disableDemoMode();
      },
      setUser: (user) => {
        set({ user, hasAcceptedTerms: deriveHasAcceptedTerms(user) });
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
      storage: createJSONStorage(() => sessionStorage),
      /**
       * SecureStore has a per-value size limit on Android (2048 bytes) and the full `PrivateUser`
       * (community, schools, profileMedia, credits, stats) can easily exceed it. Only the token and
       * the session flags are persisted; `user` is re-fetched by `useSelf` on every launch and
       * written back through `setUser`, which already re-runs `syncCommunityTheme`.
       *
       * `demoMode` MUST stay in this same persisted object: the token and the flag have to
       * rehydrate in the same turn, or a window opens where a demo token is loaded and demo mode is
       * still off, and requests would escape to the real API.
       */
      partialize: (state) => ({
        authToken: state.authToken,
        hasAcceptedTerms: state.hasAcceptedTerms,
        hasToken: state.hasToken,
        demoMode: state.demoMode,
      }),
      /**
       * Al volver de disco hay que reinstalar el modo demo antes de que la app pida nada: el token
       * persistido es de la demo y contra la API real no significa nada.
       */
      onRehydrateStorage: () => (state) => {
        if (state?.demoMode) enableDemoMode();
      },
    },
  ),
);

/**
 * ¿Ya volvió el store de disco?
 *
 * `AsyncStorage` es asíncrono, así que en el primer render `demoMode` vale `false` aunque el
 * dispositivo tenga una sesión demo guardada. Cualquier decisión de "esto no se hace en modo demo"
 * tomada antes de la hidratación se toma con el dato equivocado — y lo hace en la dirección
 * peligrosa. Quien tenga que decidir eso en un efecto de montaje, que espere acá primero.
 */
export const useSessionHydrated = () => {
  const [hydrated, setHydrated] = useState(() => useSessionStore.persist.hasHydrated());
  useEffect(() => useSessionStore.persist.onFinishHydration(() => setHydrated(true)), []);
  return hydrated;
};
