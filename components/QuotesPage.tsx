"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, RefreshCw, X } from "lucide-react";
import {
  factoryStatusLabel,
  isSystemLogged,
} from "@/lib/quotes/labels";
import type { QuoteListItem } from "@/lib/quotient/quote-types";
import { journeyOutcomeFromStatus } from "@/lib/quotient/quote-types";
import { formatCreatedDate, formatShortDate } from "@/lib/mockData";
import { listQuotes, type FrpQuoteStatus } from "@/lib/frp/api";
import { JobsPagination } from "@/components/JobsPagination";

const QUOTES_PAGE_SIZE = 10;

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
  // Gated on factory_job_status rather than job_id. QuotationDTO does expose a
  // jobId now, but factory_status is what this badge is actually reporting -
  // where the work is - and it is only ever set once a job exists.
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

/** Backend row (raw JSON, mixed camelCase/snake_case) → the UI's `QuoteListItem`. */
function mapQuoteRow(row: Record<string, unknown>): QuoteListItem {
  const r = row;
  const journey_outcome = journeyOutcomeFromStatus(r.status);

  return {
    quote_number: String(r.quoteNumber ?? r.quote_number ?? ""),
    title: (r.title as string | null) ?? null,
    quote_for_company_name: String(
      r.company ?? r.customerName ?? r.quote_for_company_name ?? ""
    ),
    quote_status: (r.status ?? r.quoteStatus ?? r.quote_status ?? null) as
      | string
      | null,
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

function StatusFilterDropdown({
  selected,
  onChange,
}: {
  selected: FrpQuoteStatus[];
  onChange: (next: FrpQuoteStatus[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open]);

  const toggle = (value: FrpQuoteStatus) => {
    onChange(
      selected.includes(value)
        ? selected.filter((s) => s !== value)
        : [...selected, value]
    );
  };

  const triggerLabel =
    selected.length === 0
      ? "All statuses"
      : selected.length === 1
        ? statusLabel(selected[0])
        : `${selected.length} statuses selected`;

  return (
    <div ref={rootRef} className="relative w-full sm:w-56">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="inline-flex w-full min-h-[40px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filter by quote status"
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          aria-label="Quote status options"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {STATUS_OPTIONS.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <li key={opt.value} role="option" aria-selected={checked}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                  />
                  {opt.label}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function QuotesPage() {
  const [statusFilters, setStatusFilters] = useState<FrpQuoteStatus[]>([]);
  const [page, setPage] = useState(1);
  // Bumped by the Refresh button to force the effect below to re-run.
  const [reloadToken, setReloadToken] = useState(0);

  const statusFilterKey = statusFilters.join(",");

  // Pagination is real, backend-driven — one GET /quotes?page=&size=10&status=
  // request per page/status change, showing exactly what the backend returns.
  const [pageRows, setPageRows] = useState<QuoteListItem[]>([]);
  const [pageTotalItems, setPageTotalItems] = useState(0);
  const [pageTotalPages, setPageTotalPages] = useState(1);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    setPageError(null);

    listQuotes(page - 1, QUOTES_PAGE_SIZE, {
      status: statusFilters.length > 0 ? statusFilters : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setPageRows((res.content ?? []).map((row) => mapQuoteRow(row as Record<string, unknown>)));
        setPageTotalItems(res.totalElements ?? 0);
        const total = Math.max(1, res.totalPages ?? 1);
        setPageTotalPages(total);
        if (page > total) setPage(total);
      })
      .catch((e) => {
        if (cancelled) return;
        setPageError(e instanceof Error ? e.message : "Could not load quotes");
        setPageRows([]);
        setPageTotalItems(0);
        setPageTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilterKey, page, reloadToken]);

  useEffect(() => {
    setPage(1);
  }, [statusFilterKey]);

  const hasActiveFilters = statusFilters.length > 0;
  const clearFilters = () => {
    setStatusFilters([]);
  };

  const loading = pageLoading;
  const error = pageError;
  const pagedQuotes = pageRows;
  const pages = pageTotalPages;
  const safePage = page;
  const totalItems = pageTotalItems;

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
              <StatusFilterDropdown
                selected={statusFilters}
                onChange={setStatusFilters}
              />
            </div>
            <button
              type="button"
              onClick={() => setReloadToken((t) => t + 1)}
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
              {statusFilters.map((status) => (
                <FilterChip
                  key={status}
                  label={`Status: ${statusLabel(status)}`}
                  onClear={() =>
                    setStatusFilters((prev) => prev.filter((s) => s !== status))
                  }
                />
              ))}
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
          ) : totalItems === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-slate-500">
              No quotes found. Webhooks populate this list automatically.
            </p>
          ) : (
            pagedQuotes.map((q) => <QuoteMobileCard key={q.quote_number} q={q} />)
          )}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Quote Number</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Quote Status</th>
                  <th className="px-4 py-3">System Logged</th>
                  <th className="px-4 py-3">Job Status</th>
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
                ) : totalItems === 0 ? (
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
                  pagedQuotes.map((q) => (
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
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && (
          <div className="mt-4">
            <JobsPagination
              page={safePage}
              totalPages={pages}
              pageSize={QUOTES_PAGE_SIZE}
              totalItems={totalItems}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </main>
  );
}
