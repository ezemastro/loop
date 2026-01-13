import { useSessionStore } from "@/stores/session";

export default function Aside() {
  const fullName = useSessionStore((state) => state.fullName);
  return (
    <aside className="flex flex-col">
      <div className="p-4 text-wrap">
        <p>{fullName}</p>
      </div>
      <nav className="flex flex-col p-4 space-y-2">
        <a href="/" className="hover:underline">
          Inicio
        </a>
        <a href="/settings" className="hover:underline">
          Configuración
        </a>
        <a href="/logout" className="hover:underline">
          Cerrar sesión
        </a>
      </nav>
    </aside>
  );
}
