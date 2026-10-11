"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { QuotientQuote } from "@/lib/quotient/quote-types";
import {
  factoryStatusLabel,
  journeyOutcomeLabel,
} from "@/lib/supabase/quotes-repository";

/** Read-only Quotient snapshot on job card — factory PDF fields edited separately below. */
export function JobCardQuotientPanel({ jobId }: { jobId: string }) {
  const match = /^JOB-Q-(.+)$/i.exec(jobId);
  const quoteNumber = match?.[1];
  const [quote, setQuote] = useState<QuotientQuote | null>(null);

  useEffect(() => {
    if (!quoteNumber) return;
    let cancelled = false;
    void fetch(`/api/quotes/${encodeURIComponent(quoteNumber)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { quote?: QuotientQuote } | null) => {
        if (!cancelled && data?.quote) setQuote(data.quote);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [quoteNumber]);

  if (!quoteNumber) return null;

  return (
    <section className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
            Quotient (read-only)
          </h2>
          <p className="mt-0.5 text-xs text-blue-700/90">
            Sales quote data — edit factory PDF fields in the sections below.
          </p>
        </div>
        <Link
          href={`/quotes/${encodeURIComponent(quoteNumber)}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          Full quote →
        </Link>
      </div>

      {quote ? (
        <div className="mt-3 grid min-w-0 gap-2 text-sm sm:grid-cols-2 [&_p]:min-w-0 [&_p]:break-words">
          <p>
            <span className="font-medium text-slate-600">quote_number:</span>{" "}
            {quote.quote_number}
          </p>
          <p>
            <span className="font-medium text-slate-600">quote_status:</span>{" "}
            {quote.quote_status ?? "—"}
          </p>
          <p>
            <span className="font-medium text-slate-600">journey:</span>{" "}
            {journeyOutcomeLabel(quote.journey_outcome)}
          </p>
          <p>
            <span className="font-medium text-slate-600">factory_job_status:</span>{" "}
            {factoryStatusLabel(quote.factory_job_status)}
          </p>
          <p>
            <span className="font-medium text-slate-600">valid_until:</span>{" "}
            {quote.valid_until
              ? new Date(quote.valid_until + "T12:00:00").toLocaleDateString(
                  "en-AU",
                  { day: "numeric", month: "short", year: "numeric" }
                )
              : "—"}
          </p>
          <p>
            <span className="font-medium text-slate-600">order_number:</span>{" "}
            {quote.accepted_order_number ?? "—"}
          </p>
          <p>
            <span className="font-medium text-slate-600">Contact:</span>{" "}
            {quote.quote_for_contact_name ?? "—"}
            {quote.quote_for_email && ` · ${quote.quote_for_email}`}
          </p>
          {quote.quote_url && (
            <a
              href={quote.quote_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 hover:underline sm:col-span-2"
            >
              quote_url
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
          {(quote.questions?.length ?? 0) > 0 && (
            <p className="sm:col-span-2 text-violet-900">
              {quote.questions?.length} customer question
              {(quote.questions?.length ?? 0) !== 1 ? "s" : ""} — see Quotes tab for full thread
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Loading Quotient data…</p>
      )}
    </section>
  );
}
