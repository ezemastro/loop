import { useIsSuperAdmin, useSessionStore } from "@/stores/session";
import { NavLink, useNavigate } from "react-router";

interface NavItem {
  to: string;
  icon: string;
  label: string;
  /** Entradas que solo existen para un super admin (catálogos compartidos y comunidades). */
  superAdminOnly?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Panorama",
    items: [{ to: "/dashboard", icon: "📊", label: "Dashboard" }],
  },
  {
    title: "Comunidad",
    items: [
      { to: "/users", icon: "👥", label: "Usuarios" },
      { to: "/schools", icon: "🏫", label: "Colegios" },
      { to: "/invitations", icon: "✉️", label: "Invitaciones" },
      { to: "/notifications", icon: "🔔", label: "Notificaciones" },
      { to: "/deletion-requests", icon: "🗑️", label: "Bajas de cuenta" },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { to: "/communities", icon: "🌐", label: "Comunidades", superAdminOnly: true },
      { to: "/categories", icon: "📁", label: "Categorías", superAdminOnly: true },
      { to: "/missions", icon: "🎯", label: "Misiones", superAdminOnly: true },
      { to: "/authorize-admin", icon: "🔑", label: "Autorizar admin" },
    ],
  },
];

export default function Aside() {
  const fullName = useSessionStore((state) => state.fullName);
  const communityName = useSessionStore((state) => state.communityName);
  const isSuperAdmin = useIsSuperAdmin();
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
      isActive
        ? "bg-slate-700/80 font-medium text-white"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Loop</p>
        <p className="text-sm font-semibold text-white">Panel de administración</p>
      </div>

      <div className="border-b border-slate-800 px-5 py-4">
        <p className="truncate text-sm font-semibold text-white">{fullName ?? "Administrador"}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {isSuperAdmin ? "Super administrador" : "Administrador de comunidad"}
        </p>
        {/* El alcance tiene que estar siempre a la vista: define todo lo que ve el resto del panel. */}
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span aria-hidden>🌐</span>
          <span className="truncate text-slate-200">
            {isSuperAdmin ? "Todas las comunidades" : (communityName ?? "Sin comunidad")}
          </span>
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section) => {
          const items = section.items.filter((item) => isSuperAdmin || !item.superAdminOnly);
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-5 last:mb-0">
              <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.15em] text-slate-500 uppercase">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClass}>
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <span aria-hidden>🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
