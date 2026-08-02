"use client";

import { RefreshCw, Radio } from "lucide-react";

const AUTO_REFRESH_KEY = "bmsman-analytics-auto-refresh";

export function readAutoRefreshPreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(AUTO_REFRESH_KEY);
  if (stored === "false") return false;
  if (stored === "true") return true;
  return true;
}

export function writeAutoRefreshPreference(enabled: boolean) {
  localStorage.setItem(AUTO_REFRESH_KEY, enabled ? "true" : "false");
}

export const ANALYTICS_POLL_MS = 12_000;

interface AnalyticsRefreshControlProps {
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: Date | null;
  compact?: boolean;
}

function formatLastSync(d: Date | null): string {
  if (!d) return "Not synced yet";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AnalyticsRefreshControl({
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  refreshing,
  lastUpdated,
  compact = false,
}: AnalyticsRefreshControlProps) {
  return (
    <div
      className={`flex items-center gap-2 ${compact ? "flex-wrap justify-end" : "flex-col sm:flex-row sm:items-center"}`}
    >
      <div
        className={`flex items-center gap-1.5 text-slate-600 ${compact ? "text-xs" : "gap-2 text-sm"}`}
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full border ${
            compact ? "px-2 py-0.5" : "gap-1.5 px-2.5 py-1"
          } ${
            autoRefresh
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          <Radio
            className={`h-3.5 w-3.5 ${autoRefresh ? "analytics-live-dot text-emerald-600" : ""}`}
            aria-hidden
          />
          {autoRefresh ? "Live" : "Paused"}
        </span>
        {!compact && <span className="hidden sm:inline text-slate-400">·</span>}
        <span className="tabular-nums">
          {refreshing ? "Syncing…" : formatLastSync(lastUpdated)}
        </span>
      </div>

      <div
        className={`flex items-center rounded-lg border border-slate-200 bg-white shadow-sm ${
          compact ? "gap-1 p-0.5" : "gap-2 rounded-xl p-1"
        }`}
      >
        <label
          className={`flex cursor-pointer items-center rounded-md font-medium text-slate-700 hover:bg-slate-50 ${
            compact ? "gap-1.5 px-2 py-1 text-xs" : "gap-2 px-3 py-2 text-sm"
          }`}
        >
          <span className="sr-only">Auto refresh</span>
          {!compact && <span aria-hidden>Auto refresh</span>}
          <button
            type="button"
            role="switch"
            aria-checked={autoRefresh}
            onClick={() => onAutoRefreshChange(!autoRefresh)}
            className={`relative shrink-0 rounded-full transition-colors duration-200 ${
              compact ? "h-5 w-9" : "h-6 w-11"
            } ${autoRefresh ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <span
              className={`absolute rounded-full bg-white shadow transition-transform duration-200 ${
                compact ? "top-0.5 left-0.5 h-4 w-4" : "top-0.5 left-0.5 h-5 w-5"
              } ${autoRefresh ? (compact ? "translate-x-4" : "translate-x-5") : "translate-x-0"}`}
            />
          </button>
          <span
            className={`font-semibold ${compact ? "text-[10px]" : "text-xs"} ${
              autoRefresh ? "text-blue-600" : "text-slate-500"
            }`}
          >
            {autoRefresh ? "On" : "Off"}
          </span>
        </label>

        <span className={`w-px bg-slate-200 ${compact ? "h-5" : "h-6"}`} aria-hidden />

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={`inline-flex items-center justify-center gap-1.5 font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-60 ${
            compact ? "rounded-md px-2 py-1 text-xs" : "min-h-[40px] gap-2 rounded-lg px-4 py-2 text-sm"
          }`}
          title={autoRefresh ? "Refresh now (auto every 12s)" : "Refresh manually"}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </button>
      </div>
    </div>
  );
}
