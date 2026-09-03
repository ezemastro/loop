import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** Icono decorativo del kit; `aria-hidden` porque el título ya describe el estado vacío. */
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "py-14",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center px-6 text-center ${className}`}>
      <Icon aria-hidden size={32} strokeWidth={1.75} className="text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
