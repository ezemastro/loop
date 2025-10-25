import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SessionStore {
  user: User | null;
  hasAcceptedTerms: boolean;
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setHasAcceptedTerms: (accepted: boolean) => void;
}
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null, hasAcceptedTerms: false }),
      setUser: (user) => set({ user }),
      hasAcceptedTerms: false,
      setHasAcceptedTerms: (accepted: boolean) =>
        set({ hasAcceptedTerms: accepted }),
    }),
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
