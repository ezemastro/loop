interface SpinnerProps {
  className?: string;
}

export default function Spinner({ className = "h-5 w-5" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 ${className}`}
    />
  );
}

interface LoadingBlockProps {
  label?: string;
  /** Alto mínimo; se baja cuando el bloque vive dentro de una tarjeta chica. */
  className?: string;
}

/** Estado de carga a página/tarjeta completa, para no repetir el mismo div en cada vista. */
export function LoadingBlock({ label = "Cargando…", className = "py-16" }: LoadingBlockProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
