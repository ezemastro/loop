import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionStore {
  isLoggedIn: boolean;
  fullName: string | null;
  email: string | null;
  /** Rol del admin logueado; define qué ve el panel entero. */
  role: AdminRole | null;
  /** null ⇔ super admin: su alcance son todas las comunidades. */
  communityId: UUID | null;
  communityName: string | null;
  login: (admin: Admin) => void;
  logout: () => void;
}

const LOGGED_OUT = {
  isLoggedIn: false,
  fullName: null,
  email: null,
  role: null,
  communityId: null,
  communityName: null,
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      ...LOGGED_OUT,
      login: (admin: Admin) =>
        set(() => ({
          isLoggedIn: true,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
          communityId: admin.communityId,
          communityName: admin.community?.name ?? null,
        })),
      logout: () => set(() => ({ ...LOGGED_OUT })),
    }),
    {
      name: "session-storage",
      version: 3,
      // Las sesiones viejas no guardaban rol ni comunidad. Adivinarlos daría un panel con los
      // permisos equivocados, así que se fuerza un login nuevo.
      migrate: () => ({ ...LOGGED_OUT }),
      // `email`, `fullName` y `communityName` no se persisten: son datos personales y no hace
      // falta tenerlos antes del primer login. El costo aceptado es que el sidebar muestra sus
      // fallbacks hasta el siguiente login exitoso.
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        role: state.role,
        communityId: state.communityId,
      }),
    },
  ),
);

/** Atajo: el rol condiciona rutas, columnas y filtros en casi todas las páginas. */
export const useIsSuperAdmin = () => useSessionStore((state) => state.role === "super_admin");
