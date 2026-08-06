import type { JourneyOutcome } from "@/lib/quotient/quote-types";

export interface QuotientEventSummary {
  event_name: string;
  count: number;
}

export interface RecentQuotientEvent {
  id: string;
  quotient_id: string;
  event_name: string;
  created_at: string;
  title?: string;
  journey_outcome?: JourneyOutcome | null;
  factory_job_status?: string | null;
  quote_status?: string | null;
  job_logged?: boolean;
}

export interface AnalyticsSnapshot {
  quotientEvents: QuotientEventSummary[];
  quotientTotal: number;
  recentQuotientEvents: RecentQuotientEvent[];
  inventoryReorderCount: number;
  inventoryLowStock: {
    sku_code: string;
    description_1: string;
    stock_quantity: number;
    reorder_level: number;
  }[];
}

/** Empty snapshot until DEL-02 quote analytics land on Spring Boot. */
export function emptyAnalyticsSnapshot(): AnalyticsSnapshot {
  return {
    quotientEvents: [
      "quote_sent",
      "customer_viewed",
      "customer_question",
      "quote_accepted",
      "quote_declined",
      "quote_completed",
    ].map((event_name) => ({ event_name, count: 0 })),
    quotientTotal: 0,
    recentQuotientEvents: [],
    inventoryReorderCount: 0,
    inventoryLowStock: [],
  };
}
