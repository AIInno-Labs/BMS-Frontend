"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";

export function FilterDropdown({
  value,
  options,
  onChange,
  icon: Icon,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
}) {
  return (
    <div className="relative inline-flex items-center">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 appearance-none rounded-lg border border-[#E2E8F0] bg-white pr-8 text-sm font-medium text-[#111827] shadow-sm outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40 ${
          Icon ? "pl-9" : "pl-3"
        }`}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400"
        aria-hidden
      />
    </div>
  );
}

export function FilterChips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-orange-50 text-orange-700"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
