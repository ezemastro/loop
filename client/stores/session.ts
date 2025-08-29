import { create } from "zustand";

interface SessionStore {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}
export const useSessionStore = create<SessionStore>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
