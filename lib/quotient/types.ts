/**
 * Quotient webhook payloads — https://www.quotientapp.com/help/quotient-webhooks
 */

export type QuotientEventName =
  | "quote_accepted"
  | "quote_completed"
  | "quote_declined"
  | "quote_sent"
  | "customer_viewed"
  | "customer_question";

export const QUOTIENT_EVENT_NAMES: QuotientEventName[] = [
  "quote_sent",
  "customer_viewed",
  "customer_question",
  "quote_accepted",
  "quote_declined",
  "quote_completed",
];

export interface QuotientPhone {
  type?: string;
  value?: string;
}

export interface QuotientAddress {
  type?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface QuotientContact {
  name_first?: string;
  name_last?: string;
  email?: string;
  company_name?: string;
  phone?: QuotientPhone;
  address?: QuotientAddress;
}

export interface QuotientQuoteFor extends QuotientContact {}

export interface QuotientSelectedItem {
  item_code?: string;
  heading?: string;
  description?: string;
  sales_category?: string;
  tax_rate?: number | string;
  tax_description?: string;
  subscription?: string;
  discount?: number;
  cost_price?: number;
  unit_price?: number;
  quantity?: number;
  item_total?: number;
}

export interface QuotientAcceptedBlock {
  accepted_on_behalf?: boolean;
  accepted_on_behalf_who?: string;
  order_number?: string;
  comments?: string;
  when?: string;
  by?: QuotientContact | string;
}

export interface QuotientDeclinedBlock {
  marked_as_declined?: boolean;
  comments?: string;
  when?: string;
  by?: QuotientContact;
}

export interface QuotientViewedBlock {
  when?: string;
  total_views?: string | number;
  by?: QuotientContact;
}

export interface QuotientQuestionBlock {
  when?: string;
  text?: string;
  by?: QuotientContact;
}

export interface QuotientWebhookPayload {
  event_name: QuotientEventName | string;
  quote_number: number;
  title: string;
  quote_url?: string;
  from?: string;
  for?: string;
  first_sent?: string;
  valid_until?: string;
  quote_status?: string;
  progress?: string;
  is_archived?: boolean;
  currency?: string;
  amounts_are?: string;
  overall_discount?: number;
  total_includes_tax?: number;
  total_excludes_tax?: number;
  discount_amount_includes_tax?: number;
  discount_amount_excludes_tax?: number;
  deposit_percent?: number;
  deposit_amount_includes_tax?: number;
  deposit_amount_excludes_tax?: number;
  item_headings?: string;
  quote_for?: QuotientQuoteFor;
  selected_items?: QuotientSelectedItem[];
  accepted?: QuotientAcceptedBlock;
  declined?: QuotientDeclinedBlock;
  viewed?: QuotientViewedBlock;
  question?: QuotientQuestionBlock;
}
