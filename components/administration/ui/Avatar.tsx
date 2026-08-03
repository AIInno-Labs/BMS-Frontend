export function Avatar({
  initials,
  colorClassName = "bg-slate-200 text-slate-700",
  size = "md",
  online,
}: {
  initials: string;
  colorClassName?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-12 w-12 text-base" : "h-9 w-9 text-sm";

  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-lg font-semibold ${sizeClass} ${colorClassName}`}
      >
        {initials}
      </span>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
            online ? "bg-emerald-500" : "bg-slate-300"
          }`}
          aria-hidden
        />
      )}
    </span>
  );
}
