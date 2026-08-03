import type { ReactNode } from "react";

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="app-card !p-5">
      <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function InfoCardRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-slate-500">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-[#111827]">{value}</span>
    </div>
  );
}
