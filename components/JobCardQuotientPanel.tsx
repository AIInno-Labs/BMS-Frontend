"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getQuote } from "@/lib/frp/api";
import type { QuotientQuote } from "@/lib/quotient/quote-types";
import {
  factoryStatusLabel,
  journeyOutcomeLabel,
} from "@/lib/quotes/labels";

/** Read-only Quotient snapshot on job card — factory PDF fields edited separately below. */
export function JobCardQuotientPanel({ jobId }: { jobId: string }) {
  const match = /^JOB-Q-(.+)$/i.exec(jobId);
  const quoteNumber = match?.[1];
  const [quote, setQuote] = useState<QuotientQuote | null>(null);

  // Cached per key in a ref, not just guarded by `cancelled`: React Strict
  // Mode (dev only) mounts every component twice, and a plain `cancelled`
  // flag only suppresses which invocation's result gets applied — the first
  // invocation still fires its own GET. Sharing one promise per key means
  // both mounts attach to the same in-flight request instead.
  const quoteFetchRef = useRef<{
    key: string;
    promise: ReturnType<typeof getQuote>;
  } | null>(null);
  useEffect(() => {
    if (!quoteNumber) return;
    let mounted = true;
    if (quoteFetchRef.current?.key !== quoteNumber) {
      quoteFetchRef.current = { key: quoteNumber, promise: getQuote(quoteNumber) };
    }
    quoteFetchRef.current.promise
      .then((raw) => {
        if (mounted && raw) setQuote(raw as unknown as QuotientQuote);
      })
      .catch(() => {});
    return () => {
      mounted = false;
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
            {quote ? null : " (Quote API pending DEL-02 on Spring Boot.)"}
          </p>
        </div>
        <Link
          href={`/quotes/${encodeURIComponent(quoteNumber)}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          Full quote →
        </Link>
      </div>
      {quote && (
        <div className="mt-3 grid gap-2 text-sm text-slate-800 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-500">Quote #</span>{" "}
            {quote.quote_number}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Journey</span>{" "}
            {journeyOutcomeLabel(quote.journey_outcome)}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Factory</span>{" "}
            {factoryStatusLabel(quote.factory_job_status)}
          </p>
          {quote.quote_url && (
            <p className="sm:col-span-2">
              <a
                href={quote.quote_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900"
              >
                Open in Quotient <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
