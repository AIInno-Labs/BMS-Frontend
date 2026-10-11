import { createSupabaseAdmin } from "@/lib/supabase/server";
import type {
  JourneyOutcome,
  QuoteEventRow,
  QuoteLineItem,
  QuoteListItem,
  QuoteQuestion,
  QuotientQuote,
} from "@/lib/quotient/quote-types";

interface DbQuoteRow {
  id: string;
  quotient_quote_id: string;
  customer_name: string;
  total_amount: number | null;
  status: string;
  currency: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_event_name?: string | null;
  journey_outcome?: JourneyOutcome | null;
  factory_job_status?: string | null;
  quote_url?: string | null;
  quote_from?: string | null;
  quote_for_label?: string | null;
  first_sent?: string | null;
  valid_until?: string | null;
  quote_status?: string | null;
  progress?: string | null;
  is_archived?: boolean | null;
  amounts_are?: string | null;
  overall_discount?: number | null;
  total_includes_tax?: number | null;
  total_excludes_tax?: number | null;
  discount_amount_includes_tax?: number | null;
  discount_amount_excludes_tax?: number | null;
  deposit_percent?: number | null;
  deposit_amount_includes_tax?: number | null;
  deposit_amount_excludes_tax?: number | null;
  item_headings?: string | null;
  quote_for_name_first?: string | null;
  quote_for_name_last?: string | null;
  quote_for_email?: string | null;
  quote_for_phone?: string | null;
  quote_for_phone_type?: string | null;
  quote_for_street?: string | null;
  quote_for_city?: string | null;
  quote_for_state?: string | null;
  quote_for_zip?: string | null;
  quote_for_country?: string | null;
  accepted_order_number?: string | null;
  accepted_comments?: string | null;
  accepted_when?: string | null;
  accepted_on_behalf?: boolean | null;
  declined_comments?: string | null;
  declined_when?: string | null;
  viewed_when?: string | null;
  viewed_total_views?: number | null;
  last_question_text?: string | null;
  last_question_when?: string | null;
}

const QUOTE_LIST_SELECT = `
  id,
  quotient_quote_id,
  customer_name,
  title,
  status,
  quote_status,
  progress,
  journey_outcome,
  last_event_name,
  factory_job_status,
  total_includes_tax,
  total_amount,
  currency,
  updated_at
`;

function contactName(row: DbQuoteRow): string | null {
  const name = [row.quote_for_name_first, row.quote_for_name_last]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || null;
}

function mapQuoteRow(
  row: DbQuoteRow,
  lineItems: QuoteLineItem[],
  questions: QuoteQuestion[],
  events: QuoteEventRow[]
): QuotientQuote {
  const quoteNumber = row.quotient_quote_id;
  const company = row.customer_name;
  return {
    id: row.id,
    quote_number: quoteNumber,
    title: row.title,
    quote_status: row.quote_status ?? row.status,
    progress: row.progress ?? null,
    journey_outcome: (row.journey_outcome ?? "open") as JourneyOutcome,
    last_event_name: row.last_event_name ?? null,
    factory_job_status: row.factory_job_status ?? null,
    job_id: `JOB-Q-${quoteNumber}`,
    quote_url: row.quote_url ?? null,
    quote_from: row.quote_from ?? null,
    quote_for_label: row.quote_for_label ?? null,
    first_sent: row.first_sent ?? null,
    valid_until: row.valid_until ?? null,
    is_archived: row.is_archived ?? false,
    currency: row.currency,
    amounts_are: row.amounts_are ?? null,
    overall_discount: row.overall_discount ?? null,
    total_includes_tax: row.total_includes_tax ?? row.total_amount,
    total_excludes_tax: row.total_excludes_tax ?? null,
    discount_amount_includes_tax: row.discount_amount_includes_tax ?? null,
    discount_amount_excludes_tax: row.discount_amount_excludes_tax ?? null,
    deposit_percent: row.deposit_percent ?? null,
    deposit_amount_includes_tax: row.deposit_amount_includes_tax ?? null,
    deposit_amount_excludes_tax: row.deposit_amount_excludes_tax ?? null,
    item_headings: row.item_headings ?? null,
    customer_name: company,
    quote_for_company_name: company,
    quote_for_name_first: row.quote_for_name_first ?? null,
    quote_for_name_last: row.quote_for_name_last ?? null,
    quote_for_contact_name: contactName(row),
    quote_for_email: row.quote_for_email ?? null,
    quote_for_phone: row.quote_for_phone ?? null,
    quote_for_phone_type: row.quote_for_phone_type ?? null,
    quote_for_street: row.quote_for_street ?? null,
    quote_for_city: row.quote_for_city ?? null,
    quote_for_state: row.quote_for_state ?? null,
    quote_for_zip: row.quote_for_zip ?? null,
    quote_for_country: row.quote_for_country ?? null,
    accepted_order_number: row.accepted_order_number ?? null,
    accepted_comments: row.accepted_comments ?? null,
    accepted_when: row.accepted_when ?? null,
    accepted_on_behalf: row.accepted_on_behalf ?? null,
    declined_comments: row.declined_comments ?? null,
    declined_when: row.declined_when ?? null,
    viewed_when: row.viewed_when ?? null,
    viewed_total_views: row.viewed_total_views ?? null,
    last_question_text: row.last_question_text ?? null,
    last_question_when: row.last_question_when ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    line_items: lineItems,
    questions,
    events,
  };
}

export async function listQuotesFromDb(): Promise<QuoteListItem[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_LIST_SELECT)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DbQuoteRow[];
  const quoteIds = rows.map((r) => r.id);

  const questionCounts: Record<string, number> = {};
  if (quoteIds.length > 0) {
    const { data: qCounts } = await supabase
      .from("quote_questions")
      .select("quote_id")
      .in("quote_id", quoteIds);
    for (const q of qCounts ?? []) {
      questionCounts[q.quote_id as string] =
        (questionCounts[q.quote_id as string] ?? 0) + 1;
    }
  }

  const jobNumbers = rows.map((r) => `JOB-Q-${r.quotient_quote_id}`);
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, workflow_status")
    .in("id", jobNumbers);

  const jobStatus: Record<string, string> = {};
  for (const j of jobs ?? []) {
    jobStatus[j.id as string] = j.workflow_status as string;
  }

  return rows.map((row) => {
    const jobId = `JOB-Q-${row.quotient_quote_id}`;
    const factoryStatus =
      row.factory_job_status ?? jobStatus[jobId] ?? null;
    return {
      quote_number: row.quotient_quote_id,
      title: row.title,
      quote_for_company_name: row.customer_name,
      quote_status: row.quote_status ?? row.status,
      progress: row.progress ?? null,
      journey_outcome: (row.journey_outcome ?? "open") as JourneyOutcome,
      last_event_name: row.last_event_name ?? null,
      factory_job_status: factoryStatus,
      job_id: jobStatus[jobId] ? jobId : null,
      total_includes_tax: row.total_includes_tax ?? row.total_amount,
      currency: row.currency,
      updated_at: row.updated_at,
      question_count: questionCounts[row.id] ?? 0,
    };
  });
}

export async function getQuoteByNumberFromDb(
  quoteNumber: string
): Promise<QuotientQuote | null> {
  const supabase = createSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("quotient_quote_id", quoteNumber)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;

  const dbRow = row as DbQuoteRow;

  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select(
      "sl_no, item_code, heading, description, sales_category, tax_rate, tax_description, subscription, discount, cost_price, unit_price, quantity, item_total"
    )
    .eq("quote_id", dbRow.id)
    .order("sl_no");

  const { data: questions } = await supabase
    .from("quote_questions")
    .select("id, question_when, question_text, asked_by, created_at")
    .eq("quote_id", dbRow.id)
    .order("question_when", { ascending: true });

  const { data: events } = await supabase
    .from("quote_events_history")
    .select("id, event_name, processing_status, processing_error, created_at")
    .eq("quotient_id", quoteNumber)
    .order("created_at", { ascending: true });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, workflow_status")
    .eq("id", `JOB-Q-${quoteNumber}`)
    .maybeSingle();

  if (job && !dbRow.factory_job_status) {
    dbRow.factory_job_status = job.workflow_status as string;
  }

  return mapQuoteRow(
    dbRow,
    (lineItems ?? []) as QuoteLineItem[],
    (questions ?? []) as QuoteQuestion[],
    (events ?? []) as QuoteEventRow[]
  );
}

export function journeyOutcomeLabel(outcome: JourneyOutcome): string {
  switch (outcome) {
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "accepted":
      return "Accepted";
    default:
      return "Open";
  }
}

export function factoryStatusLabel(status: string | null | undefined): string {
  if (!status) return "No factory job";
  return status;
}

export function isFactoryComplete(
  journeyOutcome: JourneyOutcome,
  factoryJobStatus: string | null | undefined
): boolean {
  return (
    journeyOutcome === "completed" ||
    factoryJobStatus === "Complete" ||
    factoryJobStatus === "Cancelled"
  );
}
