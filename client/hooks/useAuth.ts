import { useSessionStore } from "@/stores/session";

export const useAuth = () => {
  const user = useSessionStore((state) => state.user);
  return { user, isLoggedIn: !!user };
};
