import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      user: null,
      authToken: null,
      login: (user, token) =>
        set((state) => ({
          user,
          authToken: token ?? state.authToken,
        })),
      logout: () =>
        set({
          user: null,
          authToken: null,
          hasAcceptedTerms: false,
          hasToken: false,
        }),
      setUser: (user) => set({ user }),
      setAuthToken: (token) => set({ authToken: token }),
      hasAcceptedTerms: false,
      setHasAcceptedTerms: (accepted: boolean) =>
        set({ hasAcceptedTerms: accepted }),
      hasToken: false,
      setHasToken: (hasToken: boolean) => set({ hasToken }),
    }),
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
