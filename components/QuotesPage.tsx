"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, RefreshCw, X } from "lucide-react";
import {
  factoryStatusLabel,
  isFactoryComplete,
  isSystemLogged,
  journeyOutcomeLabel,
} from "@/lib/quotes/labels";
import type { QuoteListItem } from "@/lib/quotient/quote-types";
import { formatCreatedDate, formatShortDate } from "@/lib/mockData";
import { listQuotes, type FrpQuoteStatus } from "@/lib/frp/api";

const STATUS_OPTIONS: { value: FrpQuoteStatus; label: string }[] = [
  { value: "AWAITING_ACCEPTANCE", label: "Awaiting acceptance" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "EXPIRED", label: "Expired" },
  { value: "COMPLETED", label: "Completed" },
];

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function JourneyBadge({ item }: { item: QuoteListItem }) {
  const complete = isFactoryComplete(
    item.journey_outcome,
    item.factory_job_status
  );
  const outcome = journeyOutcomeLabel(item.journey_outcome);
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        complete
          ? "bg-emerald-100 text-emerald-800"
          : item.journey_outcome === "declined"
          ? "bg-red-100 text-red-800"
          : item.journey_outcome === "accepted"
          ? "bg-blue-100 text-blue-800"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {outcome}
    </span>
  );
}

function SystemLoggedBadge({ logged }: { logged: boolean }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        logged ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
      }`}
      title={
        logged
          ? "Factory job exists (factoryStatus is set)"
          : "No factory job yet — factoryStatus is null"
      }
    >
      {logged ? "Yes" : "No"}
    </span>
  );
}

function QuoteMobileCard({ q }: { q: QuoteListItem }) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-blue-600">Quote</p>
          <p className="text-lg font-semibold text-slate-900">
            {q.quote_number}
          </p>
        </div>
        <JourneyBadge item={q} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">
        {q.title ?? "—"}
      </p>
      <p className="mt-1 text-sm text-slate-600">{q.quote_for_company_name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SystemLoggedBadge logged={isSystemLogged(q.factory_job_status)} />
        <FactoryBadge item={q} />
        {q.quote_status && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {q.quote_status}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Created {formatShortDate(q.created_at)}
        {q.updated_at ? ` · Updated ${formatCreatedDate(q.updated_at)}` : ""}
        {q.last_event_name ? ` · ${q.last_event_name.replace(/_/g, " ")}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/quotes/${encodeURIComponent(q.quote_number)}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
        >
          View quote
        </Link>
        {q.job_id && (
          <Link
            href={`/jobs/${encodeURIComponent(q.job_id)}`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            Job card
          </Link>
        )}
      </div>
    </article>
  );
}

function FactoryBadge({ item }: { item: QuoteListItem }) {
  // Gated on factory_job_status, not job_id - QuotationDTO doesn't expose a
  // job id at all, but factory_status is only ever set (both by the backend
  // and by seed.sql) when a quote-derived job actually exists, so it's the
  // reliable signal here.
  if (!item.factory_job_status) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  const status = item.factory_job_status ?? "—";
  const done =
    status === "Complete" ||
    status === "COMPLETED" ||
    status === "Cancelled";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        done
          ? status === "Complete" || status === "COMPLETED"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-slate-200 text-slate-700"
          : "bg-amber-100 text-amber-900"
      }`}
      title="Factory job workflow status"
    >
      {factoryStatusLabel(status)}
    </span>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-800">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-800"
        aria-label={`Remove filter: ${label}`}
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

export function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FrpQuoteStatus | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Status is filtered server-side (GET /quotes?status=...). Search still
      // has no server-side support, so page through every result (rather than
      // capping at some fixed size) so it has the complete table to search —
      // no magic ceiling to outgrow as the table gets bigger.
      const PAGE_SIZE = 500;
      const MAX_PAGES = 500; // safety net against a runaway loop, not a real cap
      const rows: Record<string, unknown>[] = [];
      for (let pageNum = 0; pageNum < MAX_PAGES; pageNum++) {
        const page = await listQuotes(pageNum, PAGE_SIZE, {
          status: statusFilter || undefined,
        });
        rows.push(...(page.content ?? []));
        if (page.last || (page.content ?? []).length === 0) break;
      }
      const quotes = rows.map((row) => {
        const r = row as Record<string, unknown>;

        const journeyRaw = String(
          r.journeyStatus ?? r.journey_outcome ?? ""
        ).toLowerCase();
        const journey_outcome: QuoteListItem["journey_outcome"] =
          journeyRaw === "accepted" ||
          journeyRaw === "declined" ||
          journeyRaw === "completed"
            ? journeyRaw
            : "open";

        return {
          quote_number: String(r.quoteNumber ?? r.quote_number ?? ""),
          title: (r.title as string | null) ?? null,
          quote_for_company_name: String(
            r.company ?? r.customerName ?? r.quote_for_company_name ?? ""
          ),
          quote_status: (r.status ??
            r.quoteStatus ??
            r.quote_status ??
            null) as string | null,
          progress: (r.progress as string | null) ?? null,
          journey_outcome,
          factory_job_status: (r.factoryStatus ??
            r.factoryJobStatus ??
            r.factory_job_status ??
            null) as string | null,
          job_id: (r.jobId ?? r.job_id ?? null) as string | null,
          total_includes_tax:
            (r.totalIncludesTax as number | null) ??
            (r.total_includes_tax as number | null) ??
            null,
          currency: String(r.currency ?? "AUD"),
          last_event_name: (r.lastEvent ??
            r.lastEventName ??
            r.last_event_name ??
            null) as string | null,
          created_at:
            (r.createdAt as string | null) ??
            (r.created_at as string | null) ??
            (r.createdDate as string | null) ??
            null,
          updated_at: String(
            r.occurredAt ?? r.updatedAt ?? r.updated_at ?? r.lastModifiedDate ?? ""
          ),
          question_count: Number(r.questionCount ?? r.question_count ?? 0),
        } satisfies QuoteListItem;
      });
      setQuotes(quotes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quotes");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilters = statusFilter !== "";
  const clearFilters = () => {
    setStatusFilter("");
  };

  const filtered = quotes.filter((q) => {
    const hay = `${q.quote_number} ${q.title ?? ""} ${
      q.quote_for_company_name
    } ${q.quote_status ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <main className="app-mesh-bg min-h-screen overflow-x-hidden">
      <div className="relative mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-sm font-medium uppercase tracking-widest text-blue-600">
            Quotient CRM
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Quotes
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600">
            Full Quotient webhook data — same field names as Quotient. Factory
            execution stays on Jobs (official PDF job card).
          </p>
        </header>

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quote #, title, company…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as FrpQuoteStatus | "")
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-44"
                aria-label="Filter by quote status"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary inline-flex w-full shrink-0 items-center justify-center gap-1.5 sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </button>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {statusFilter && (
                <FilterChip
                  label={`Status: ${statusLabel(statusFilter)}`}
                  onClear={() => setStatusFilter("")}
                />
              )}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            {error.includes("not available") && (
              <span className="mt-1 block text-slate-700">
                Quotes load from Spring Boot{" "}
                <code className="text-xs">/quotes</code> once DEL-02 is live.
                Jobs already use PostgreSQL via{" "}
                <code className="text-xs">/jobs</code>.
              </span>
            )}
          </p>
        )}

        <div className="space-y-3 md:hidden">
          {loading ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
              Loading quotes…
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
              No quotes found. Webhooks populate this list automatically.
            </p>
          ) : (
            filtered.map((q) => <QuoteMobileCard key={q.quote_number} q={q} />)
          )}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Quote Number</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Quote For</th>
                  <th className="px-4 py-3">Quote Status</th>
                  <th className="px-4 py-3">Journey</th>
                  <th className="px-4 py-3">System Logged</th>
                  <th className="px-4 py-3">Factory Status</th>
                  <th className="px-4 py-3">Last Event</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Loading quotes…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No quotes found. Webhooks populate this list
                      automatically.
                    </td>
                  </tr>
                ) : (
                  filtered.map((q) => (
                    <tr
                      key={q.quote_number}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {q.quote_number}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-800">
                        {q.title ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {q.quote_for_company_name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {q.quote_status ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <JourneyBadge item={q} />
                      </td>
                      <td className="px-4 py-3">
                        <SystemLoggedBadge logged={isSystemLogged(q.factory_job_status)} />
                      </td>
                      <td className="px-4 py-3">
                        <FactoryBadge item={q} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {q.last_event_name
                          ? q.last_event_name
                              .split("_")
                              .map(
                                (w) => w.charAt(0).toUpperCase() + w.slice(1)
                              )
                              .join(" ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatShortDate(q.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatCreatedDate(q.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {q.question_count > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-xs text-violet-700"
                              title={`${q.question_count} customer question(s)`}
                            >
                              <MessageCircle
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
                              {q.question_count}
                            </span>
                          )}
                          <Link
                            href={`/quotes/${encodeURIComponent(
                              q.quote_number
                            )}`}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
                            View
                          </Link>
                          {q.job_id && (
                            <Link
                              href={`/jobs/${encodeURIComponent(q.job_id)}`}
                              className="text-sm text-slate-600 hover:text-slate-900"
                            >
                              Job
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
