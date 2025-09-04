import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SessionStore {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}
export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
