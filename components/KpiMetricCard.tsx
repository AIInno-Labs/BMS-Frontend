"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type KpiAccent = "notStarted" | "manufacturing" | "delivered" | "neutral";

const accentStyles: Record<
  KpiAccent,
  { dot: string; value: string; spark: string }
> = {
  neutral: {
    dot: "bg-slate-500",
    value: "text-slate-900",
    spark: "#64748b",
  },
  notStarted: {
    dot: "bg-red-500",
    value: "text-red-600",
    spark: "#EF4444",
  },
  manufacturing: {
    dot: "bg-amber-500",
    value: "text-amber-600",
    spark: "#F59E0B",
  },
  delivered: {
    dot: "bg-emerald-500",
    value: "text-emerald-600",
    spark: "#10B981",
  },
};

interface KpiMetricCardProps {
  label: string;
  value: number | string;
  sub: string;
  accent: KpiAccent;
  href: string;
  suffix?: string;
  /** Dense layout for command dashboard — no sparkline footer */
  compact?: boolean;
}

export function KpiMetricCard({
  label,
  value,
  sub,
  accent,
  href,
  suffix,
  compact = false,
}: KpiMetricCardProps) {
  const styles = accentStyles[accent];

  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md ${
        compact ? "px-3 py-2.5" : "rounded-xl p-4"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-1.5 ${
          compact ? "mb-1" : "mb-3"
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 rounded-full ${styles.dot} ${
              compact ? "h-1.5 w-1.5" : "h-2 w-2"
            }`}
            aria-hidden
          />
          <span
            className={`truncate font-semibold uppercase tracking-wider text-slate-500 ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            {label}
          </span>
        </div>
        <ChevronRight
          className={`shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 ${
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          }`}
          aria-hidden
        />
      </div>

      <p
        className={`font-bold leading-none tracking-tight ${styles.value} ${
          compact ? "text-2xl" : "text-4xl"
        }`}
      >
        {value}
        {suffix && (
          <span
            className={`font-semibold text-slate-500 ${
              compact ? "text-lg" : "text-2xl"
            }`}
          >
            {suffix}
          </span>
        )}
      </p>
      <p
        className={`text-slate-600 ${compact ? "mt-0.5 text-xs leading-tight" : "mt-1.5 text-base"}`}
      >
        {sub}
      </p>
    </Link>
  );
}
