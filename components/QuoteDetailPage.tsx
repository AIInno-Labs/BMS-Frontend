"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  factoryStatusLabel,
  isFactoryComplete,
  progressLabel,
} from "@/lib/quotes/labels";
import { formatQuotientContact } from "@/lib/quotient/formatContact";
import type { QuotientQuote } from "@/lib/quotient/quote-types";
import { journeyOutcomeFromStatus } from "@/lib/quotient/quote-types";
import { formatCreatedDate } from "@/lib/mockData";
import { getQuote } from "@/lib/frp/api";
import { useAuth } from "@/context/AuthContext";
import { FIELD_KEYS } from "@/lib/frp/access";

/**
 * Maps `GET /quotes/{quoteNumber}` onto the page model.
 * Header + quote_for come from `payload`; totals from `paymentDetails`;
 * accepted / declined / viewed / customer questions from `events[]`.
 * Journey badges still use top-level `status` / `lastEvent` because
 * `payload.quote_status` can lag behind the latest event.
 */
function normalizeQuote(raw: Record<string, unknown>): QuotientQuote {
  const journey_outcome = journeyOutcomeFromStatus(raw.status);

  const fromDetails = (raw.fromDetails ?? {}) as Record<string, unknown>;
  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const payment = (raw.paymentDetails ?? raw.payment_details ?? {}) as Record<
    string,
    unknown
  >;
  const quoteFor = (payload.quote_for ??
    raw.quoteFor ??
    raw.quote_for ??
    {}) as Record<string, unknown>;
  const rawEvents = (raw.events ?? []) as Record<string, unknown>[];

  const str = (v: unknown): string | null =>
    v === null || v === undefined || v === "" ? null : String(v);
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  /** Walks a dotted path (`"accepted.order_number"`) through a plain object. */
  const at = (obj: Record<string, unknown>, path: string): unknown =>
    path.split(".").reduce<unknown>((cur, key) => {
      if (cur === null || typeof cur !== "object") return undefined;
      return (cur as Record<string, unknown>)[key];
    }, obj);

  const eventByCode = (code: string): Record<string, unknown> | null => {
    const matches = rawEvents.filter(
      (e) => String(e.eventCode ?? e.event_name ?? "") === code
    );
    if (matches.length === 0) return null;
    const latest = [...matches].sort((a, b) =>
      String(b.occurredAt ?? "").localeCompare(String(a.occurredAt ?? ""))
    )[0];
    return (latest.payload ?? {}) as Record<string, unknown>;
  };
  const nested = (
    evPayload: Record<string, unknown> | null,
    key: string
  ): Record<string, unknown> | null => {
    const value = evPayload?.[key];
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  };

  const acceptedEvent = eventByCode("quote_accepted") ?? eventByCode("quote_completed");
  const declinedEvent = eventByCode("quote_declined");
  const viewedEvent = eventByCode("customer_viewed");
  const acceptedDetails =
    nested(acceptedEvent, "accepted") ??
    (raw.lastEvent === "quote_accepted" || raw.lastEvent === "quote_completed"
      ? ((raw.eventDetails ?? null) as Record<string, unknown> | null)
      : null);
  const declinedDetails =
    nested(declinedEvent, "declined") ??
    (raw.lastEvent === "quote_declined"
      ? ((raw.eventDetails ?? null) as Record<string, unknown> | null)
      : null);
  const viewedDetails =
    nested(viewedEvent, "viewed") ??
    (raw.lastEvent === "customer_viewed"
      ? ((raw.eventDetails ?? null) as Record<string, unknown> | null)
      : null);

  const acceptedItems = Array.isArray(acceptedEvent?.selected_items)
    ? (acceptedEvent!.selected_items as Record<string, unknown>[])
    : null;
  const payloadItems = Array.isArray(payload.selected_items)
    ? (payload.selected_items as Record<string, unknown>[])
    : null;
  const storedSelectedItems = Array.isArray(raw.selectedItems)
    ? (raw.selectedItems as Record<string, unknown>[])
    : Array.isArray(raw.lineItems)
      ? (raw.lineItems as Record<string, unknown>[])
      : Array.isArray(raw.measurement)
        ? (raw.measurement as Record<string, unknown>[])
        : [];
  const lineItems =
    storedSelectedItems.length > 0
      ? storedSelectedItems
      : (payloadItems ?? acceptedItems ?? []);

  const contact = str(quoteFor.contact) ?? str(quoteFor.contact_name);
  const [contactFirst, ...contactRest] = contact?.split(/\s+/) ?? [];
  const contactLast = contactRest.join(" ");

  const phoneRaw = quoteFor.phone;
  const phoneObj =
    phoneRaw && typeof phoneRaw === "object"
      ? (phoneRaw as Record<string, unknown>)
      : null;
  const addressObj = (quoteFor.address ?? {}) as Record<string, unknown>;

  const nameFirst = str(quoteFor.name_first) ?? str(contactFirst);
  const nameLast = str(quoteFor.name_last) ?? str(contactLast || null);
  const fullName =
    [nameFirst, nameLast].filter(Boolean).join(" ") || contact;

  const questionsFromEvents: QuotientQuote["questions"] = rawEvents
    .filter((e) => String(e.eventCode ?? e.event_name ?? "") === "customer_question")
    .map((e) => {
      const q = nested((e.payload ?? {}) as Record<string, unknown>, "question") ?? {};
      return {
        id: String(e.id ?? ""),
        question_when: str(q.when) ?? str(e.occurredAt),
        question_text: String(q.text ?? "").trim(),
        asked_by:
          q.by && typeof q.by === "object"
            ? (q.by as Record<string, unknown>)
            : null,
        created_at: String(e.occurredAt ?? ""),
      };
    })
    .filter((q) => q.question_text)
    .sort((a, b) =>
      String(a.question_when ?? a.created_at).localeCompare(
        String(b.question_when ?? b.created_at)
      )
    );
  const payloadQuestion = nested(payload, "question");
  const questions: QuotientQuote["questions"] =
    questionsFromEvents.length > 0
      ? questionsFromEvents
      : Array.isArray(raw.questions)
        ? (raw.questions as QuotientQuote["questions"])
        : payloadQuestion?.text
          ? [
              {
                id: "payload-question",
                question_when: str(payloadQuestion.when),
                question_text: String(payloadQuestion.text),
                asked_by:
                  payloadQuestion.by && typeof payloadQuestion.by === "object"
                    ? (payloadQuestion.by as Record<string, unknown>)
                    : null,
                created_at: String(payloadQuestion.when ?? raw.occurredAt ?? ""),
              },
            ]
          : [];

  return {
    id: str(raw.id) ?? "",
    quote_number: String(
      payload.quote_number ?? raw.quoteNumber ?? raw.quote_number ?? ""
    ),
    title: str(payload.title) ?? str(raw.title),
    quote_status: str(raw.status ?? raw.quote_status) ?? str(payload.quote_status),
    progress: str(payload.progress) ?? str(raw.progress),
    journey_outcome,
    last_event_name: str(raw.lastEvent ?? raw.last_event_name),
    factory_job_status: str(raw.factoryStatus ?? raw.factory_job_status),
    job_id: str(raw.jobId ?? raw.job_id),
    quote_url: str(payload.quote_url) ?? str(raw.quoteUrl ?? raw.quote_url),
    quote_from:
      str(payload.from) ??
      str(fromDetails.name) ??
      str(fromDetails.contactName) ??
      str(fromDetails.businessName),
    // Company first. Quotient's `for` and the contact's own name are both
    // people, and a quote is for the business - so the company answers "who is
    // this for", with the individual left to the contact fields below.
    quote_for_label:
      str(quoteFor.company_name) ??
      str(quoteFor.company) ??
      str(raw.company) ??
      str(payload.for) ??
      fullName,
    first_sent: str(payload.first_sent),
    valid_until: str(payload.valid_until) ?? str(raw.validUntil ?? raw.valid_until),
    is_archived: Boolean(
      payload.is_archived ?? raw.archived ?? raw.isArchived ?? raw.is_archived ?? false
    ),
    currency: String(payload.currency ?? payment.currency ?? raw.currency ?? "AUD"),
    amounts_are:
      str(payload.amounts_are) ?? str(payment.amountsAre ?? raw.amountsAre ?? raw.amounts_are),
    overall_discount: num(payment.overallDiscount) ?? num(payload.overall_discount),
    total_includes_tax:
      num(payment.totalIncludesTax) ??
      num(payment.amountAfterTax) ??
      num(payload.total_includes_tax),
    total_excludes_tax:
      num(payment.totalExcludesTax) ??
      num(payment.amountBeforeTax) ??
      num(payload.total_excludes_tax),
    discount_amount_includes_tax:
      num(payment.discountAmountIncludesTax) ??
      num(payload.discount_amount_includes_tax),
    discount_amount_excludes_tax:
      num(payment.discountAmountExcludesTax) ??
      num(payload.discount_amount_excludes_tax),
    deposit_percent: num(payment.depositPercent) ?? num(payload.deposit_percent),
    deposit_amount_includes_tax:
      num(payment.depositAmountIncludesTax) ??
      num(payload.deposit_amount_includes_tax),
    deposit_amount_excludes_tax:
      num(payment.depositAmountExcludesTax) ??
      num(payload.deposit_amount_excludes_tax),
    tax_amount: num(payment.taxAmount),
    net_amount: num(payment.netAmount),
    item_headings:
      (lineItems.length
        ? lineItems
            .map((item) => str(item.heading))
            .filter(Boolean)
            .join("\n") || null
        : null) ??
      str(payload.item_headings) ??
      str(acceptedEvent?.item_headings) ??
      str(raw.itemHeadings ?? raw.item_headings),
    customer_name: String(
      quoteFor.company_name ?? quoteFor.company ?? payload.for ?? raw.company ?? ""
    ),
    quote_for_company_name: String(
      quoteFor.company_name ?? quoteFor.company ?? payload.for ?? raw.company ?? ""
    ),
    quote_for_name_first: nameFirst,
    quote_for_name_last: nameLast,
    quote_for_contact_name: contact,
    quote_for_email: str(quoteFor.email),
    quote_for_phone: phoneObj ? str(phoneObj.value) : str(quoteFor.phone),
    quote_for_phone_type: phoneObj
      ? str(phoneObj.type)
      : str(quoteFor.phone_type),
    quote_for_street: str(addressObj.street) ?? str(quoteFor.street),
    quote_for_city: str(addressObj.city) ?? str(quoteFor.city),
    quote_for_state: str(addressObj.state) ?? str(quoteFor.state),
    quote_for_zip: str(addressObj.zip) ?? str(quoteFor.zip),
    quote_for_country: str(addressObj.country) ?? str(quoteFor.country),
    accepted_order_number:
      str(acceptedDetails?.order_number) ?? str(at(payload, "accepted.order_number")),
    accepted_comments:
      str(acceptedDetails?.comments) ?? str(at(payload, "accepted.comments")),
    accepted_when: str(acceptedDetails?.when) ?? str(at(payload, "accepted.when")),
    accepted_on_behalf:
      (acceptedDetails?.accepted_on_behalf as boolean | null) ??
      (at(payload, "accepted.accepted_on_behalf") as boolean | null) ??
      null,
    declined_comments:
      str(declinedDetails?.comments) ?? str(at(payload, "declined.comments")),
    declined_when: str(declinedDetails?.when) ?? str(at(payload, "declined.when")),
    viewed_when: str(viewedDetails?.when) ?? str(at(payload, "viewed.when")),
    viewed_total_views:
      num(viewedDetails?.total_views) ?? num(at(payload, "viewed.total_views")),
    last_question_text:
      questions[questions.length - 1]?.question_text ??
      str(payloadQuestion?.text) ??
      str(raw.lastQuestionText),
    last_question_when:
      questions[questions.length - 1]?.question_when ??
      str(payloadQuestion?.when) ??
      str(raw.lastQuestionWhen),
    created_at: String(raw.createdDate ?? raw.created_at ?? ""),
    updated_at: String(raw.occurredAt ?? raw.lastModifiedDate ?? raw.updated_at ?? ""),
    line_items: lineItems.map((item, i) => ({
      sl_no: i + 1,
      item_code: str(item.item_code ?? item.itemCode),
      heading: str(item.heading) ?? str(item.description),
      description: str(item.description),
      sales_category: str(item.sales_category ?? item.salesCategory),
      tax_rate: str(item.tax_rate ?? item.taxRate),
      tax_description: str(item.tax_description ?? item.taxDescription),
      subscription: str(item.subscription),
      discount: num(item.discount),
      cost_price: num(item.cost_price ?? item.costPrice),
      unit_price: num(item.unit_price ?? item.unitPrice),
      quantity: num(item.quantity),
      item_total: num(item.total ?? item.item_total ?? item.itemTotal),
    })),
    questions,
    events: rawEvents.map((ev) => ({
      id: String(ev.id ?? ""),
      event_name: String(ev.eventCode ?? ev.event_name ?? ""),
      processing_status: String(
        ev.processingStatus ??
          ev.processing_status ??
          (ev.processed ? "processed" : ev.failed ? "failed" : "pending")
      ),
      processing_error: str(ev.processError ?? ev.processing_error),
      created_at: String(ev.occurredAt ?? ev.created_at ?? ""),
    })),
  };
}

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
    <div className="min-w-0">
      <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-0.5 break-words text-sm font-medium text-slate-900 ${mono ? "font-mono" : ""}`}
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
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
  const { canField } = useAuth();
  const canSeeRate = canField(FIELD_KEYS.RATE, "READ");
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
      setQuote(normalizeQuote(raw as Record<string, unknown>));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load quote");
    } finally {
      setLoading(false);
    }
  }, [quoteNumber]);

  const lastLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastLoadedKeyRef.current === quoteNumber) return;
    lastLoadedKeyRef.current = quoteNumber;
    void load();
  }, [load, quoteNumber]);

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
              progress: {progressLabel(quote.progress, quote.journey_outcome)}
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                quote.factory_job_status === "Complete" ||
                quote.factory_job_status === "COMPLETED"
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
              <Field label="title" value={quote.title} />
              <Field label="first_sent" value={quote.first_sent ? formatCreatedDate(quote.first_sent) : null} />
              <Field label="valid_until" value={quote.valid_until ? formatCreatedDate(quote.valid_until) : null} />
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
              <Field label="tax_amount" value={quote.tax_amount} />
              <Field label="net_amount" value={quote.net_amount} />
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
            <div className="mt-3">
              <Field label="comments" value={quote.accepted_comments} />
            </div>
          </Section>

          <Section title="declined">
            <div className="space-y-3">
              <Field label="when" value={quote.declined_when ? formatCreatedDate(quote.declined_when) : null} />
              <Field label="comments" value={quote.declined_comments} />
            </div>
          </Section>

          <Section title="viewed">
            <div className="space-y-3">
              <Field label="when" value={quote.viewed_when ? formatCreatedDate(quote.viewed_when) : null} />
              <Field label="total_views" value={quote.viewed_total_views} />
            </div>
          </Section>
        </div>

        <div className="mt-4 space-y-4">
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
                    {canSeeRate && <th className="px-2 py-2">unit_price</th>}
                    <th className="px-2 py-2">item_total</th>
                    {canSeeRate && <th className="px-2 py-2">discount</th>}
                    <th className="px-2 py-2">tax_rate</th>
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
                        {line.subscription && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            subscription: {line.subscription}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">{line.quantity ?? "—"}</td>
                      {canSeeRate && (
                        <td className="px-2 py-2">{line.unit_price ?? "—"}</td>
                      )}
                      <td className="px-2 py-2">{line.item_total ?? "—"}</td>
                      {canSeeRate && (
                        <td className="px-2 py-2">{line.discount ?? "—"}</td>
                      )}
                      <td className="px-2 py-2" title={line.tax_description ?? undefined}>
                        {line.tax_rate ? `${line.tax_rate}%` : "—"}
                      </td>
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
      </div>
    </main>
  );
}
