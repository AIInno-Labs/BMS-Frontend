"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import {
  factoryStatusLabel,
  isFactoryComplete,
  journeyOutcomeLabel,
} from "@/lib/supabase/quotes-repository";
import type { QuoteListItem } from "@/lib/quotient/quote-types";
import { formatCreatedDate } from "@/lib/mockData";

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
          ? "Job exists in Jobs tab (JOB-Q-…)"
          : "Not in Jobs yet — waiting for quote_accepted"
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
          <p className="text-lg font-semibold text-slate-900">{q.quote_number}</p>
        </div>
        <JourneyBadge item={q} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">
        {q.title ?? "—"}
      </p>
      <p className="mt-1 text-sm text-slate-600">{q.quote_for_company_name}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SystemLoggedBadge logged={Boolean(q.job_id)} />
        <FactoryBadge item={q} />
        {q.quote_status && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {q.quote_status}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Updated {formatCreatedDate(q.updated_at)}
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
  if (!item.job_id) {
    return (
      <span className="text-xs text-slate-500">—</span>
    );
  }
  const status = item.factory_job_status ?? "—";
  const done = status === "Complete" || status === "Cancelled";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        done
          ? status === "Complete"
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

export function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quotes");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as { quotes: QuoteListItem[] };
      setQuotes(data.quotes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = quotes.filter((q) => {
    const hay = `${q.quote_number} ${q.title ?? ""} ${q.quote_for_company_name} ${q.quote_status ?? ""}`.toLowerCase();
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

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote #, title, company…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary w-full shrink-0 sm:w-auto"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            {error.includes("column") && (
              <span className="mt-1 block">
                Run migration{" "}
                <code className="text-xs">20260529_quotient_full_mirror.sql</code>{" "}
                in Supabase SQL Editor.
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
            <table className="w-full min-w-[980px] text-left text-sm">
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
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Loading quotes…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No quotes found. Webhooks populate this list automatically.
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
                        <SystemLoggedBadge logged={Boolean(q.job_id)} />
                      </td>
                      <td className="px-4 py-3">
                        <FactoryBadge item={q} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {q.last_event_name
                          ? q.last_event_name
                              .split("_")
                              .map(
                                (w) =>
                                  w.charAt(0).toUpperCase() + w.slice(1)
                              )
                              .join(" ")
                          : "—"}
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
                              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                              {q.question_count}
                            </span>
                          )}
                          <Link
                            href={`/quotes/${encodeURIComponent(q.quote_number)}`}
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
