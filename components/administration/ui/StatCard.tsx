import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  iconClassName = "bg-orange-50 text-orange-600",
  label,
  value,
  trend,
  sub,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  trend?: { label: string; tone: "positive" | "neutral" };
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="app-card !p-5">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </span>
        {trend && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              trend.tone === "positive"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-[#111827]">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && (
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}
