import type { QuoteListItem } from "@/lib/quotient/quote-types";
import { journeyOutcomeFromStatus } from "@/lib/quotient/quote-types";

/**
 * Backend row (raw JSON, mixed camelCase/snake_case) → the UI's `QuoteListItem`.
 *
 * Shared by any screen that lists `GET /quotes` rows (QuotesPage, CrmPage) so
 * the camelCase/snake_case normalization only lives in one place.
 */
export function mapQuoteRow(row: Record<string, unknown>): QuoteListItem {
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
