import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

type AlertTone = "error" | "success" | "warning" | "info";

const TONES: Record<AlertTone, { box: string; icon: LucideIcon }> = {
  error: { box: "border-red-200 bg-red-50 text-red-800", icon: TriangleAlert },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CircleCheck },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: TriangleAlert },
  info: { box: "border-indigo-200 bg-indigo-50 text-indigo-900", icon: Info },
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function Alert({ tone = "info", title, children, className = "" }: AlertProps) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${box} ${className}`}>
      <Icon aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
