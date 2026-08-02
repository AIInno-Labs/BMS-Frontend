"use client";

import { useJobs } from "@/context/JobsContext";

const fieldClass =
  "mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20";

interface RaisedBySelectProps {
  value: string;
  onChange: (displayName: string) => void;
  disabled?: boolean;
  className?: string;
  /** Compact styling for workflow dashboard modals */
  variant?: "default" | "compact";
}

export function RaisedBySelect({
  value,
  onChange,
  disabled = false,
  className,
  variant = "default",
}: RaisedBySelectProps) {
  const { directors, directorsLoading, hydrated } = useJobs();

  const selectClass =
    variant === "compact"
      ? `mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm ${className ?? ""}`
      : `${fieldClass} ${className ?? ""}`;

  const legacy =
    value.trim() &&
    !directors.some((d) => d.display_name === value.trim());

  if (disabled) {
    return <p className="text-sm text-slate-800">{value.trim() || "—"}</p>;
  }

  if (!hydrated || directorsLoading) {
    return (
      <select disabled className={selectClass} aria-label="Raised by">
        <option>Loading directors…</option>
      </select>
    );
  }

  if (directors.length === 0) {
    return (
      <p className="text-sm text-amber-700">
        No directors in database. Run{" "}
        <code className="text-xs">supabase/scripts/directors-setup.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <select
      value={value.trim()}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
      aria-label="Raised by"
    >
      {!value.trim() && !legacy && (
        <option value="" disabled>
          Select director…
        </option>
      )}
      {legacy && (
        <option value={value.trim()}>{value.trim()} (not in director list)</option>
      )}
      {directors.map((d) => (
        <option key={d.id} value={d.display_name}>
          {d.display_name}
        </option>
      ))}
    </select>
  );
}
