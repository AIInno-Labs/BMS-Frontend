import type {
  QuotientContact,
  QuotientSelectedItem,
  QuotientWebhookPayload,
} from "@/lib/quotient/types";

export function quotientIdFromPayload(payload: QuotientWebhookPayload): string {
  return String(payload.quote_number);
}

/** Formats Quotient `by` contact objects (accepted / declined / viewed / question). */
export function formatQuotientContact(
  contact: QuotientContact | string | undefined
): string | null {
  if (!contact) return null;
  if (typeof contact === "string") return contact.trim() || null;
  const name = [contact.name_first, contact.name_last]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || contact.email || contact.company_name || null;
}

function parseIsoTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function mapQuoteRow(payload: QuotientWebhookPayload) {
  const qf = payload.quote_for;
  const accepted = payload.accepted;

  return {
    quotient_quote_number: payload.quote_number,
    quotient_event_name: payload.event_name,
    title: payload.title,
    quote_url: payload.quote_url ?? null,
    quote_from: payload.from?.trim() ?? null,
    quote_status: payload.quote_status ?? "Unknown",
    progress: payload.progress ?? null,
    is_archived: payload.is_archived ?? false,
    currency: payload.currency ?? "AUD",
    amounts_are: payload.amounts_are ?? null,
    total_excludes_tax: payload.total_excludes_tax ?? null,
    total_includes_tax: payload.total_includes_tax ?? null,
    overall_discount: payload.overall_discount ?? 0,
    discount_amount_includes_tax: payload.discount_amount_includes_tax ?? null,
    discount_amount_excludes_tax: payload.discount_amount_excludes_tax ?? null,
    deposit_percent: payload.deposit_percent ?? 0,
    deposit_amount_includes_tax: payload.deposit_amount_includes_tax ?? null,
    deposit_amount_excludes_tax: payload.deposit_amount_excludes_tax ?? null,
    item_headings: payload.item_headings ?? null,
    customer_company:
      qf?.company_name?.trim() || payload.for?.trim() || "Unknown Customer",
    customer_contact_first: qf?.name_first ?? null,
    customer_contact_last: qf?.name_last ?? null,
    customer_email: qf?.email ?? null,
    customer_phone: qf?.phone?.value ?? null,
    customer_address: qf?.address ?? null,
    accepted_order_number: accepted?.order_number ?? null,
    accepted_comments: accepted?.comments ?? null,
    accepted_by: formatQuotientContact(accepted?.by),
    accepted_on_behalf: accepted?.accepted_on_behalf ?? false,
    accepted_at: parseIsoTimestamp(accepted?.when),
    declined_at: parseIsoTimestamp(payload.declined?.when),
    declined_comments: payload.declined?.comments ?? null,
    last_viewed_at: parseIsoTimestamp(payload.viewed?.when),
    view_count: payload.viewed?.total_views
      ? Number(payload.viewed.total_views)
      : null,
    customer_question_at: parseIsoTimestamp(payload.question?.when),
    customer_question_text: payload.question?.text ?? null,
    valid_until: payload.valid_until
      ? new Date(payload.valid_until).toISOString().slice(0, 10)
      : null,
    first_sent_at: parseIsoTimestamp(payload.first_sent),
    last_webhook_at: new Date().toISOString(),
    raw_payload: payload as unknown as Record<string, unknown>,
  };
}

export function mapQuoteLineItems(
  quoteId: string,
  items: QuotientSelectedItem[] | undefined
) {
  if (!items?.length) return [];
  return items.map((item, idx) => ({
    quote_id: quoteId,
    sl_no: idx + 1,
    item_code: item.item_code ?? null,
    heading: item.heading ?? null,
    description: item.description ?? null,
    sales_category: item.sales_category ?? null,
    unit_price: item.unit_price ?? null,
    quantity: item.quantity ?? 0,
    tax_rate:
      item.tax_rate != null ? String(item.tax_rate) : null,
    tax_description: item.tax_description ?? null,
    line_discount: item.discount ?? 0,
    cost_price: item.cost_price ?? null,
    item_total: item.item_total ?? null,
    subscription: item.subscription ?? null,
  }));
}
