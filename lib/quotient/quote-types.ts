/** Quotient-aligned quote record (mirrors `quotes` + related tables). */

export type JourneyOutcome = "open" | "accepted" | "declined" | "completed";

/**
 * Where a quote ended up, derived from its `status`.
 *
 * The backend used to send a separate `journeyStatus` saying the same thing in
 * different words; it was removed as redundant. `status` is the single source:
 * AWAITING_ACCEPTANCE and EXPIRED are still open as far as the outcome goes,
 * because neither is a decision the customer made.
 */
export function journeyOutcomeFromStatus(status: unknown): JourneyOutcome {
  switch (String(status ?? "").toUpperCase()) {
    case "ACCEPTED":
      return "accepted";
    case "DECLINED":
      return "declined";
    case "COMPLETED":
      return "completed";
    default:
      return "open";
  }
}

export interface QuoteLineItem {
  sl_no: number;
  item_code: string | null;
  heading: string | null;
  description: string | null;
  sales_category: string | null;
  tax_rate: string | null;
  tax_description: string | null;
  subscription: string | null;
  discount: number | null;
  cost_price: number | null;
  unit_price: number | null;
  quantity: number | null;
  item_total: number | null;
}

export interface QuoteQuestion {
  id: string;
  question_when: string | null;
  question_text: string;
  asked_by: Record<string, unknown> | null;
  created_at: string;
}

export interface QuoteEventRow {
  id: string;
  event_name: string;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
}

export interface QuotientQuote {
  id: string;
  /** Quotient `quote_number` */
  quote_number: string;
  title: string | null;
  quote_status: string | null;
  progress: string | null;
  journey_outcome: JourneyOutcome;
  last_event_name: string | null;
  factory_job_status: string | null;
  job_id: string | null;
  quote_url: string | null;
  quote_from: string | null;
  quote_for_label: string | null;
  first_sent: string | null;
  valid_until: string | null;
  is_archived: boolean;
  currency: string;
  amounts_are: string | null;
  overall_discount: number | null;
  total_includes_tax: number | null;
  total_excludes_tax: number | null;
  discount_amount_includes_tax: number | null;
  discount_amount_excludes_tax: number | null;
  deposit_percent: number | null;
  deposit_amount_includes_tax: number | null;
  deposit_amount_excludes_tax: number | null;
  tax_amount: number | null;
  net_amount: number | null;
  item_headings: string | null;
  /** Legacy mirror */
  customer_name: string;
  quote_for_company_name: string;
  quote_for_name_first: string | null;
  quote_for_name_last: string | null;
  quote_for_contact_name: string | null;
  quote_for_email: string | null;
  quote_for_phone: string | null;
  quote_for_phone_type: string | null;
  quote_for_street: string | null;
  quote_for_city: string | null;
  quote_for_state: string | null;
  quote_for_zip: string | null;
  quote_for_country: string | null;
  accepted_order_number: string | null;
  accepted_comments: string | null;
  accepted_when: string | null;
  accepted_on_behalf: boolean | null;
  declined_comments: string | null;
  declined_when: string | null;
  viewed_when: string | null;
  viewed_total_views: number | null;
  last_question_text: string | null;
  last_question_when: string | null;
  created_at: string;
  updated_at: string;
  line_items: QuoteLineItem[];
  questions: QuoteQuestion[];
  events: QuoteEventRow[];
}

export interface QuoteListItem {
  quote_number: string;
  title: string | null;
  quote_for_company_name: string;
  quote_status: string | null;
  progress: string | null;
  journey_outcome: JourneyOutcome;
  last_event_name: string | null;
  factory_job_status: string | null;
  job_id: string | null;
  total_includes_tax: number | null;
  currency: string;
  /** Backend `createdAt` (LocalDate) — day the quote row was logged. */
  created_at: string | null;
  updated_at: string;
  question_count: number;
}
