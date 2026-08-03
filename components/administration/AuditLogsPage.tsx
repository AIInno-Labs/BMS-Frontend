"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CirclePlus,
  Download,
  LogIn,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SearchBar } from "@/components/administration/ui/SearchBar";
import { FilterDropdown } from "@/components/administration/ui/FilterDropdown";
import { Avatar } from "@/components/administration/ui/Avatar";
import {
  getAuditActionFilters,
  getAuditDateRanges,
  getAuditLogs,
} from "@/services/administration/audit.service";
import type { AuditAction, AuditLogEntry } from "@/lib/administration/types";

const ACTION_STYLES: Record<AuditAction, { label: string; className: string; icon: typeof Pencil }> = {
  UPDATE_RECORD: { label: "UPDATE_RECORD", className: "bg-emerald-50 text-emerald-700", icon: Pencil },
  CREATE_RECORD: { label: "CREATE_RECORD", className: "bg-orange-50 text-orange-700", icon: CirclePlus },
  DELETE_RECORD: { label: "DELETE_RECORD", className: "bg-red-50 text-red-700", icon: Trash2 },
  AUTH_LOGIN: { label: "AUTH_LOGIN", className: "bg-slate-100 text-slate-700", icon: LogIn },
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function AuditLogsPage() {
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState("Last 7 Days");
  const [dateRanges, setDateRanges] = useState<readonly string[]>(["Last 7 Days"]);
  const [action, setAction] = useState("All Actions");
  const [actions, setActions] = useState<readonly string[]>(["All Actions"]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await getAuditLogs({ query, action: action as AuditLogEntry["action"] | "All Actions" });
    setLogs(list);
    setLoading(false);
  }, [query, action]);

  useEffect(() => {
    getAuditDateRanges().then(setDateRanges);
    getAuditActionFilters().then(setActions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Audit Logs"
        subtitle="Track every change made across the system for compliance and troubleshooting."
        actions={
          <>
            <button type="button" className="btn-secondary inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
            <button type="button" className="btn-primary inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search logs by keyword…"
          className="sm:max-w-md sm:flex-1"
        />
        <FilterDropdown value={dateRange} options={dateRanges} onChange={setDateRange} icon={Calendar} />
        <FilterDropdown value={action} options={actions} onChange={setAction} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Client Info</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    No audit log entries match your filters.
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((entry, idx) => {
                  const style = ACTION_STYLES[entry.action];
                  const Icon = style.icon;
                  return (
                    <tr
                      key={entry.id}
                      className={`border-t border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}`}
                    >
                      <td className="px-4 py-3 align-top text-slate-600">
                        <div>{entry.timestamp.split(" ").slice(0, 2).join(" ")}</div>
                        <div className="text-xs text-slate-400">{entry.timestamp.split(" ")[2]}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={initialsFromName(entry.userName)} size="sm" />
                          <div>
                            <p className="font-semibold text-[#111827]">{entry.userName}</p>
                            <p className="text-xs text-slate-500">{entry.userRole}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
                        >
                          <Icon className="h-3 w-3" aria-hidden />
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Target: {entry.targetLabel}
                        </p>
                        {entry.detailFrom && entry.detailTo ? (
                          <p className="mt-0.5">
                            <span className="text-red-500 line-through">{entry.detailFrom}</span>{" "}
                            <span className="text-slate-400">→</span>{" "}
                            <span className="font-semibold text-emerald-600">{entry.detailTo}</span>
                          </p>
                        ) : (
                          <p className="mt-0.5">{entry.detailText}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-500">
                        <div>{entry.ipAddress}</div>
                        <div className="text-xs text-slate-400">{entry.device}</div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Showing 1-{logs.length} of {logs.length} logs
            </span>
            <span className="text-xs font-semibold text-slate-500">Page 1 of 1</span>
          </div>
        )}
      </div>
    </div>
  );
}
