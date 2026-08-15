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

  // Fuera de sesión las pantallas son pantallas completas (login, registro): no llevan chrome.
  if (!isLoggedIn) {
    return <div className="min-h-screen bg-slate-100 text-slate-900">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Aside />
      {/* `min-w-0` es lo que permite que una tabla ancha scrollee en vez de estirar la página. */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
