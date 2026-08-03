import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function SettingsCard({
  icon: Icon,
  iconClassName = "bg-orange-50 text-orange-600",
  title,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="app-card">
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </span>
        <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
