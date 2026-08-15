import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Botones de acción principal, alineados a la derecha del título. */
  actions?: ReactNode;
  /** Controles secundarios (filtros) en una fila propia debajo del encabezado. */
  filters?: ReactNode;
}

export default function PageHeader({ title, description, actions, filters }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {filters && <div className="mt-4 flex flex-wrap items-end gap-3">{filters}</div>}
    </div>
  );
}
