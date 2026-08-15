import type { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  /**
   * Ancho mínimo de la tabla. El contenedor scrollea en horizontal, así que una tabla ancha
   * nunca empuja el layout de la página.
   */
  minWidth?: string;
}

export function Table({ children, minWidth = "min-w-[720px]" }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${minWidth}`}>{children}</table>
    </div>
  );
}

interface RowProps {
  children: ReactNode;
  className?: string;
}

export function THead({ children }: RowProps) {
  return (
    <thead className="bg-slate-50">
      <tr className="border-b border-slate-200">{children}</tr>
    </thead>
  );
}

export function Th({ children, className = "" }: RowProps) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: RowProps) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function Tr({ children, className = "" }: RowProps) {
  return <tr className={`transition hover:bg-slate-50/70 ${className}`}>{children}</tr>;
}

export function Td({ children, className = "" }: RowProps) {
  return <td className={`px-4 py-3 align-middle text-slate-700 ${className}`}>{children}</td>;
}
