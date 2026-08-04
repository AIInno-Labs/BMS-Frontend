"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  factoryStatusLabel,
  isFactoryComplete,
  journeyOutcomeLabel,
} from "@/lib/quotes/labels";
import { formatQuotientContact } from "@/lib/quotient/formatContact";
import type { QuotientQuote } from "@/lib/quotient/quote-types";
import { formatCreatedDate, formatShortDate } from "@/lib/mockData";
import { getQuote } from "@/lib/frp/api";

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-medium text-slate-900 ${mono ? "font-mono" : ""}`}
      >
        {display}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const EVENT_LABELS: Record<string, string> = {
  quote_sent: "quote_sent",
  customer_viewed: "customer_viewed",
  customer_question: "customer_question",
  quote_accepted: "quote_accepted",
  quote_declined: "quote_declined",
  quote_completed: "quote_completed",
};

export function QuoteDetailPage({ quoteNumber }: { quoteNumber: string }) {
  const [quote, setQuote] = useState<QuotientQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await getQuote(quoteNumber);
      if (!raw) {
        throw new Error(
          "Quotes are not available yet — DEL-02 (Spring Boot quote module) is still in progress."
        );
      }
      setQuote(raw as unknown as QuotientQuote);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quote");
    } finally {
      setLoading(false);
    }
  }, [quoteNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-600">Loading quote #{quoteNumber}…</p>
      </main>
    );
  }

  if (error || !quote) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-red-800">{error ?? "Quote not found"}</p>
        <Link href="/quotes" className="btn-primary mt-4 inline-flex">
          Back to Quotes
        </Link>
      </main>
    );
  }

  const factoryDone = isFactoryComplete(
    quote.journey_outcome,
    quote.factory_job_status
  );

  return (
    <main className="app-mesh-bg min-h-screen overflow-x-hidden pb-12">
      <div className="relative mx-auto w-full min-w-0 max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/quotes" className="btn-ghost mb-4 inline-flex">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All quotes
        </Link>

        <header className="mb-6 min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-blue-600">
                quote_number
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">
                {quote.quote_number}
              </h1>
              <p className="mt-1 text-lg text-slate-700">{quote.title}</p>
              <p className="mt-0.5 text-slate-600">{quote.quote_for_company_name}</p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
              {quote.quote_url && (
                <a
                  href={quote.quote_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  Open in Quotient
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
              {quote.job_id && (
                <Link
                  href={`/jobs/${encodeURIComponent(quote.job_id)}`}
                  className="btn-secondary text-sm"
                >
                  Factory job card (PDF)
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 break-words">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
              quote_status: {quote.quote_status ?? "—"}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
              progress: {quote.progress ?? "—"}
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                factoryDone ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
              }`}
            >
              journey: {journeyOutcomeLabel(quote.journey_outcome)}
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                quote.factory_job_status === "Complete"
                  ? "bg-emerald-100 text-emerald-800"
                  : quote.factory_job_status
                    ? "bg-amber-100 text-amber-900"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              factory_job_status: {factoryStatusLabel(quote.factory_job_status)}
            </span>
            <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900">
              last_event_name: {quote.last_event_name ?? "—"}
            </span>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Quote header">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="from" value={quote.quote_from} />
              <Field label="for" value={quote.quote_for_label} />
              <Field label="first_sent" value={quote.first_sent ? formatCreatedDate(quote.first_sent) : null} />
              <Field label="valid_until" value={quote.valid_until ? formatShortDate(quote.valid_until) : null} />
              <Field label="currency" value={quote.currency} />
              <Field label="amounts_are" value={quote.amounts_are} />
              <Field label="is_archived" value={quote.is_archived ? "true" : "false"} />
            </div>
          </Section>

          <Section title="quote_for (customer)">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="company_name" value={quote.quote_for_company_name} />
              <Field label="name_first" value={quote.quote_for_name_first} />
              <Field label="name_last" value={quote.quote_for_name_last} />
              <Field label="email" value={quote.quote_for_email} />
              <Field label="phone" value={quote.quote_for_phone} />
              <Field label="phone.type" value={quote.quote_for_phone_type} />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase text-slate-500">address</p>
            <p className="mt-1 text-sm text-slate-800">
              {[
                quote.quote_for_street,
                quote.quote_for_city,
                quote.quote_for_state,
                quote.quote_for_zip,
                quote.quote_for_country,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </Section>

          <Section title="Totals">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="total_includes_tax" value={quote.total_includes_tax} />
              <Field label="total_excludes_tax" value={quote.total_excludes_tax} />
              <Field label="overall_discount" value={quote.overall_discount} />
              <Field label="discount_amount_includes_tax" value={quote.discount_amount_includes_tax} />
              <Field label="discount_amount_excludes_tax" value={quote.discount_amount_excludes_tax} />
              <Field label="deposit_percent" value={quote.deposit_percent} />
              <Field label="deposit_amount_includes_tax" value={quote.deposit_amount_includes_tax} />
              <Field label="deposit_amount_excludes_tax" value={quote.deposit_amount_excludes_tax} />
            </div>
          </Section>

          <Section title="accepted">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="order_number" value={quote.accepted_order_number} />
              <Field label="when" value={quote.accepted_when ? formatCreatedDate(quote.accepted_when) : null} />
              <Field label="accepted_on_behalf" value={quote.accepted_on_behalf ? "true" : "false"} />
            </div>
            <Field label="comments" value={quote.accepted_comments} />
          </Section>

          <Section title="declined">
            <Field label="when" value={quote.declined_when ? formatCreatedDate(quote.declined_when) : null} />
            <Field label="comments" value={quote.declined_comments} />
          </Section>

          <Section title="viewed">
            <Field label="when" value={quote.viewed_when ? formatCreatedDate(quote.viewed_when) : null} />
            <Field label="total_views" value={quote.viewed_total_views} />
          </Section>
        </div>

        {quote.item_headings && (
          <Section title="item_headings">
            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800">
              {quote.item_headings}
            </pre>
          </Section>
        )}

        <Section title="selected_items">
          {quote.line_items.length === 0 ? (
            <p className="text-sm text-slate-500">No line items captured yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">item_code</th>
                    <th className="px-2 py-2">heading</th>
                    <th className="px-2 py-2">quantity</th>
                    <th className="px-2 py-2">unit_price</th>
                    <th className="px-2 py-2">item_total</th>
                    <th className="px-2 py-2">sales_category</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((line) => (
                    <tr key={line.sl_no} className="border-b border-slate-100">
                      <td className="px-2 py-2">{line.sl_no}</td>
                      <td className="px-2 py-2 font-mono text-xs">{line.item_code ?? "—"}</td>
                      <td className="max-w-xs px-2 py-2">
                        <p className="font-medium">{line.heading}</p>
                        {line.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {line.description}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">{line.quantity ?? "—"}</td>
                      <td className="px-2 py-2">{line.unit_price ?? "—"}</td>
                      <td className="px-2 py-2">{line.item_total ?? "—"}</td>
                      <td className="px-2 py-2 text-slate-600">{line.sales_category ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Customer questions (conversation)">
          {quote.questions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No customer_question events yet. Each question is stored when Quotient
              sends <code className="text-xs">customer_question</code>.
            </p>
          ) : (
            <ul className="space-y-4">
              {quote.questions.map((q, i) => (
                <li
                  key={q.id}
                  className="rounded-lg border border-violet-200 bg-violet-50/50 p-3"
                >
                  <p className="text-xs font-semibold text-violet-800">
                    Message {i + 1}
                    {q.question_when && (
                      <span className="ml-2 font-normal text-violet-600">
                        {formatCreatedDate(q.question_when)}
                      </span>
                    )}
                  </p>
                  {formatQuotientContact(q.asked_by) && (
                    <p className="mt-1 text-xs text-slate-600">
                      by: {formatQuotientContact(q.asked_by)}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
                    {q.question_text}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {quote.last_question_text && quote.questions.length === 0 && (
            <p className="text-sm text-slate-700">
              Latest: {quote.last_question_text}
            </p>
          )}
        </Section>

        <Section title="Event timeline (quote_events_history)">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">event_name</th>
                  <th className="py-2 pr-4">processing_status</th>
                </tr>
              </thead>
              <tbody>
                {quote.events.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-600">
                      {formatCreatedDate(ev.created_at)}
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      {EVENT_LABELS[ev.event_name] ?? ev.event_name}
                    </td>
                    <td className="break-words py-2 pr-4">
                      <span
                        className={
                          ev.processing_status === "processed"
                            ? "text-emerald-700"
                            : ev.processing_status === "failed"
                              ? "text-red-700"
                              : "text-slate-600"
                        }
                      >
                        {ev.processing_status}
                        {ev.processing_error && (
                          <span className="block text-xs sm:inline">
                            {" "}
                            — {ev.processing_error}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </main>
  );
}
