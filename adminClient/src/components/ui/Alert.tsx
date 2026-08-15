import type { ReactNode } from "react";

type AlertTone = "error" | "success" | "warning" | "info";

const TONES: Record<AlertTone, { box: string; icon: string }> = {
  error: { box: "border-red-200 bg-red-50 text-red-800", icon: "⚠️" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: "✓" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: "⚠️" },
  info: { box: "border-indigo-200 bg-indigo-50 text-indigo-900", icon: "ℹ️" },
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function Alert({ tone = "info", title, children, className = "" }: AlertProps) {
  const { box, icon } = TONES[tone];
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${box} ${className}`}>
      <span aria-hidden className="leading-5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
