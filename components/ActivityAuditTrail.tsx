"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react";
import type { JobAuditEntry, JobAuditIcon } from "@/lib/audit/job-audit-types";

function AuditIcon({ type }: { type: JobAuditIcon }) {
  const className = "h-5 w-5 shrink-0";
  switch (type) {
    case "ai":
      return <Zap className={`${className} text-violet-600`} aria-hidden />;
    case "check":
      return (
        <CheckCircle className={`${className} text-blue-600`} aria-hidden />
      );
    case "warn":
      return (
        <AlertTriangle className={`${className} text-amber-600`} aria-hidden />
      );
    default:
      return <Clock className={`${className} text-slate-500`} aria-hidden />;
  }
}

export function ActivityAuditTrail({
  jobId,
  refreshKey = 0,
}: {
  jobId: string;
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<JobAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/audit`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Failed to load (${res.status})`
        );
      }
      const data = (await res.json()) as { entries: JobAuditEntry[] };
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit trail");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="no-print min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-base text-slate-600">Loading activity…</p>
      )}

      {error && !loading && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="mt-4 text-base text-slate-600">
          No activity recorded yet for this job.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <ol className="mt-4 space-y-0">
          {entries.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
              {index < entries.length - 1 && (
                <span
                  className="absolute top-10 left-[11px] h-[calc(100%-12px)] w-px bg-slate-200"
                  aria-hidden
                />
              )}
              <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white">
                <AuditIcon type={entry.icon} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="break-words text-sm font-medium text-slate-900 sm:text-base">
                  {entry.title}
                </p>
                <p className="mt-1 text-sm text-slate-600 sm:text-base">
                  {entry.timestamp}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
