import { useSessionStore } from "@/stores/session";
import { Link, useNavigate } from "react-router";

export default function Aside() {
  const fullName = useSessionStore((state) => state.fullName);
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="flex flex-col bg-gray-800 text-white">
      <div className="p-4 border-b border-gray-700">
        <p className="font-semibold">{fullName}</p>
        <p className="text-xs text-gray-400">Administrador</p>
      </div>
      <nav className="flex flex-col p-4 space-y-1">
        <Link
          to="/dashboard"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          📊 Dashboard
        </Link>
        <Link
          to="/users"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          👥 Usuarios
        </Link>
        <Link
          to="/schools"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          🏫 Escuelas
        </Link>
        <Link
          to="/categories"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          📁 Categorías
        </Link>
        <Link
          to="/missions"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          🎯 Misiones
        </Link>
        <Link
          to="/notifications"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          🔔 Notificaciones
        </Link>
        <Link
          to="/authorize-admin"
          className="px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          🔑 Autorizar Admin
        </Link>
        <hr className="my-4 border-gray-700" />
        <button
          onClick={handleLogout}
          className="px-3 py-2 rounded hover:bg-gray-700 transition text-left"
        >
          🚪 Cerrar sesión
        </button>
      </nav>
    </aside>
  );
}
