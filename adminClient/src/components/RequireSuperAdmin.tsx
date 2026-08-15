import { useIsSuperAdmin, useSessionStore } from "@/stores/session";
import { Navigate } from "react-router";

/**
 * Protege las rutas exclusivas de un super admin. Ocultar el link del menú no alcanza: la URL se
 * puede escribir a mano, y aunque el backend igual respondería 403, es mejor no llevar al admin a
 * una página que no le sirve.
 */
export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useSessionStore((state) => state.isLoggedIn);
  const isSuperAdmin = useIsSuperAdmin();

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
