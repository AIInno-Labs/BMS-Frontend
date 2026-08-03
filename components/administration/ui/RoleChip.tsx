export function RoleChip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        muted ? "bg-slate-100 text-slate-500" : "bg-slate-100 text-slate-700"
      }`}
    >
      {label}
    </span>
  );
}
