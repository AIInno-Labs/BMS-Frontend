"use client";

import { useEffect, useRef } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useAnimatedNumber } from "@/components/analytics/useAnimatedNumber";

function Sparkline({
  data,
  color,
  compact,
}: {
  data: number[];
  color: string;
  compact?: boolean;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const w = compact ? 52 : 72;
  const h = compact ? 18 : 26;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - 4 - ((v / max) * (h - 8));
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 opacity-90"
      aria-hidden
    >
      <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="analytics-sparkline-line"
      />
    </svg>
  );
}

export type StatAccent = "slate" | "amber" | "delivered" | "red";

const accentMap: Record<StatAccent, { value: string; spark: string; dot: string }> = {
  slate: { value: "text-slate-900", spark: "#64748b", dot: "bg-slate-500" },
  amber: { value: "text-amber-600", spark: "#F59E0B", dot: "bg-amber-500" },
  delivered: { value: "text-emerald-600", spark: "#10B981", dot: "bg-emerald-500" },
  red: { value: "text-red-600", spark: "#dc2626", dot: "bg-red-500" },
};

export interface AnimatedStatTileProps {
  label: string;
  value: number | string;
  hint: string;
  accent?: StatAccent;
  trend?: number[];
  delta?: number | null;
  live?: boolean;
  pulseKey?: string | number;
  compact?: boolean;
}

export function AnimatedStatTile({
  label,
  value,
  hint,
  accent = "slate",
  trend,
  delta,
  live = false,
  pulseKey,
  compact = false,
}: AnimatedStatTileProps) {
  const styles = accentMap[accent];
  const isNumeric = typeof value === "number";
  const numericTarget = isNumeric ? value : 0;
  const animated = useAnimatedNumber(numericTarget, isNumeric ? 550 : 0);
  const tileRef = useRef<HTMLDivElement>(null);
  const prevPulse = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey == null || pulseKey === prevPulse.current) return;
    prevPulse.current = pulseKey;
    const el = tileRef.current;
    if (!el) return;
    el.classList.remove("analytics-tile-pulse");
    void el.offsetWidth;
    el.classList.add("analytics-tile-pulse");
  }, [pulseKey]);

  const displayValue = isNumeric ? animated : value;

  return (
    <div
      ref={tileRef}
      className={`analytics-stat-tile relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${
        compact ? "p-2.5" : "rounded-xl p-4"
      } ${live ? "analytics-stat-tile--live" : ""}`}
    >
      {live && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent analytics-live-shimmer"
          aria-hidden
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot} ${
                live ? "analytics-live-dot" : ""
              }`}
              aria-hidden
            />
            <p
              className={`truncate font-semibold uppercase tracking-wider text-slate-500 ${
                compact ? "text-[10px]" : "text-xs"
              }`}
            >
              {label}
            </p>
          </div>
          <p
            className={`mt-0.5 font-bold tabular-nums tracking-tight ${styles.value} ${
              compact ? "text-xl leading-none" : "mt-1 text-3xl"
            }`}
          >
            {displayValue}
          </p>
        </div>
        {trend && trend.length > 1 && (
          <Sparkline data={trend} color={styles.spark} compact={compact} />
        )}
      </div>

      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-1" : "mt-2"}`}>
        <p className={`text-slate-600 ${compact ? "text-[11px] leading-tight" : "text-sm"}`}>
          {hint}
        </p>
        {delta != null && delta !== 0 && (
          <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              delta > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
            }`}
          >
            {delta > 0 ? (
              <TrendingUp className="h-3 w-3" aria-hidden />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden />
            )}
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
