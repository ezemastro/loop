import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionStore {
  isLoggedIn: boolean;
  fullName: string | null;
  email: string | null;
  login: (email: string, fullName: string) => void;
  logout: () => void;
}
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      fullName: null,
      email: null,
      login: (email: string, fullName: string) =>
        set(() => ({
          isLoggedIn: true,
          email,
          fullName,
        })),
      logout: () =>
        set(() => ({
          isLoggedIn: false,
          email: null,
          fullName: null,
        })),
    }),
    {
      name: "session-storage",
    },
  ),
);
