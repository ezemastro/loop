import Aside from "@/components/Aside";
import { useSessionStore } from "@/stores/session";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

const PUBLIC_PATHS = ["/", "/login", "/register"];

export default function Layout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useSessionStore((state) => state.isLoggedIn);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn && !PUBLIC_PATHS.includes(location.pathname)) {
      navigate("/login", { replace: true });
    }
  }, [isLoggedIn, location.pathname, navigate]);

  if (!isLoggedIn && !PUBLIC_PATHS.includes(location.pathname)) {
    return null;
  }

  return (
    <div className={"min-h-screen grid-cols-[200px_1fr] " + (isLoggedIn ? "grid" : "")}>
      {isLoggedIn && <Aside />}
      {children}
    </div>
  );
}
