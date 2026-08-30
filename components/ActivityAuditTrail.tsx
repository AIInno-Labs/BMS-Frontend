"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Loader2, Zap } from "lucide-react";
import type { JobAuditEntry, JobAuditIcon } from "@/lib/audit/job-audit-types";
import {
  auditTrailPageSize,
  getJobAuditTrailPage,
} from "@/lib/frp/job-audit";

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

function useAuditPageSize(): number {
  const [size, setSize] = useState(8);
  useEffect(() => {
    const update = () => setSize(auditTrailPageSize());
    update();
    const mq = window.matchMedia("(min-width: 640px)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return size;
}

export function ActivityAuditTrail({
  jobId,
  refreshKey = 0,
}: {
  jobId: string;
  refreshKey?: number;
}) {
  const pageSize = useAuditPageSize();
  const [entries, setEntries] = useState<JobAuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    if (!jobId) {
      setEntries([]);
      setHasMore(false);
      setPage(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getJobAuditTrailPage(jobId, 0, pageSize);
      setEntries(res.entries);
      setHasMore(res.hasMore);
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load audit trail");
      setEntries([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [jobId, pageSize]);

  const loadMore = useCallback(async () => {
    if (!jobId || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await getJobAuditTrailPage(jobId, nextPage, pageSize);
      setEntries((prev) => [...prev, ...res.entries]);
      setHasMore(res.hasMore);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more activity");
    } finally {
      setLoadingMore(false);
    }
  }, [jobId, page, pageSize, hasMore, loadingMore]);

  // Guarded by the last-fetched key, not just the dep array: React Strict
  // Mode (dev only) mounts every component twice, and without this the
  // audit GET fires twice on every job-page load.
  const lastFetchedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${jobId}:${refreshKey}:${pageSize}`;
    if (lastFetchedKeyRef.current === key) return;
    lastFetchedKeyRef.current = key;
    void loadFirstPage();
  }, [loadFirstPage, jobId, refreshKey, pageSize]);

  return (
    <section className="no-print min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            lastFetchedKeyRef.current = null;
            void loadFirstPage();
          }}
          disabled={loading || loadingMore}
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
        <>
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

          {hasMore ? (
            <div className="mt-4 flex justify-center border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-800 disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Show more"
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
