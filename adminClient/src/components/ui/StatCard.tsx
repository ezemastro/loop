import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /**
   * `lg` marks the headline stat in a group — larger value, larger icon, brand-colored accent.
   * Default `md` keeps the original tile size for secondary/supporting stats.
   */
  size?: "md" | "lg";
}

export default function StatCard({ label, value, hint, icon: Icon, size = "md" }: StatCardProps) {
  const isHeadline = size === "lg";
  return (
    <div
      className={`rounded-surface border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow ${isHeadline ? "p-6" : "p-5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-eyebrow font-semibold tracking-[0.15em] text-slate-500 uppercase">
          {label}
        </p>
        {Icon && (
          <Icon
            aria-hidden
            size={isHeadline ? 24 : 18}
            strokeWidth={1.75}
            className={isHeadline ? "text-brand-primary" : "text-slate-400"}
          />
        )}
      </div>
      <p
        className={`mt-2 font-semibold tracking-tight text-slate-900 tabular-nums ${
          isHeadline ? "text-4xl sm:text-5xl" : "text-3xl"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-meta mt-1 text-slate-500">{hint}</p>}
    </div>
  );
}
