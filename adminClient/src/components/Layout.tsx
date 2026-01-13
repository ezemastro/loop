import Aside from "@/components/Aside";
import { useSessionStore } from "@/stores/session";

export default function Layout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useSessionStore((state) => state.isLoggedIn);
  return (
    <div
      className={
        "min-h-screen grid-cols-[200px_1fr] " + (isLoggedIn ? "grid" : "")
      }
    >
      {isLoggedIn && <Aside />}
      {children}
    </div>
  );
}
