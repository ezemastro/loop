import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Emoji o glifo; puramente decorativo. */
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = "📭",
  title,
  description,
  action,
  className = "py-14",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center px-6 text-center ${className}`}>
      <span aria-hidden className="text-3xl">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
