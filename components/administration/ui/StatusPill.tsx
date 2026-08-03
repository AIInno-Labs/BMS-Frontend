import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Circle, XCircle } from "lucide-react";

export type StatusPillTone = "success" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<StatusPillTone, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
};

const DEFAULT_TONE_ICONS: Record<StatusPillTone, LucideIcon> = {
  success: CheckCircle2,
  warning: Circle,
  danger: XCircle,
  neutral: Circle,
};

export function StatusPill({
  label,
  tone,
  icon,
  showIcon = true,
}: {
  label: string;
  tone: StatusPillTone;
  icon?: LucideIcon;
  showIcon?: boolean;
}) {
  const ResolvedIcon = icon ?? DEFAULT_TONE_ICONS[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_STYLES[tone]}`}
    >
      {showIcon && <ResolvedIcon className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}
