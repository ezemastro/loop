import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SessionStore {
  user: PrivateUser | null;
  hasAcceptedTerms: boolean;
  login: (user: PrivateUser) => void;
  logout: () => void;
  setUser: (user: PrivateUser) => void;
  setHasAcceptedTerms: (accepted: boolean) => void;
  hasToken: boolean;
  setHasToken: (hasToken: boolean) => void;
}
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () =>
        set({ user: null, hasAcceptedTerms: false, hasToken: false }),
      setUser: (user) => set({ user }),
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
