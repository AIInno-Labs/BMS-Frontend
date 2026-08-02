import { createSupabaseAdmin } from "@/lib/supabase/server";
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

const QUOTIENT_EVENT_ORDER = [
  "quote_sent",
  "customer_viewed",
  "customer_question",
  "quote_accepted",
  "quote_declined",
  "quote_completed",
] as const;

export async function fetchAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const supabase = createSupabaseAdmin();

  const { data: events, error: evErr } = await supabase
    .from("quote_events_history")
    .select("id, quotient_id, event_name, created_at, raw_payload")
    .order("created_at", { ascending: false })
    .limit(500);

  if (evErr) throw new Error(evErr.message);

  const countMap: Record<string, number> = {};
  for (const row of events ?? []) {
    countMap[row.event_name] = (countMap[row.event_name] ?? 0) + 1;
  }

  const quotientEvents: QuotientEventSummary[] = QUOTIENT_EVENT_ORDER.map(
    (name) => ({
      event_name: name,
      count: countMap[name] ?? 0,
    })
  );

  const recentIds = [...new Set((events ?? []).slice(0, 24).map((r) => r.quotient_id))];
  const quoteMeta: Record<
    string,
    {
      journey_outcome?: JourneyOutcome;
      factory_job_status?: string | null;
      quote_status?: string | null;
    }
  > = {};

  const jobLoggedIds = new Set<string>();
  if (recentIds.length > 0) {
    const { data: quotes } = await supabase
      .from("quotes")
      .select(
        "quotient_quote_id, journey_outcome, factory_job_status, quote_status, status"
      )
      .in("quotient_quote_id", recentIds);

    for (const q of quotes ?? []) {
      quoteMeta[q.quotient_quote_id as string] = {
        journey_outcome: (q.journey_outcome as JourneyOutcome) ?? "open",
        factory_job_status: (q.factory_job_status as string) ?? null,
        quote_status: (q.quote_status as string) ?? (q.status as string),
      };
    }

    const jobIds = recentIds.map((id) => `JOB-Q-${id}`);
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, workflow_status")
      .in("id", jobIds);
    for (const j of jobs ?? []) {
      const num = (j.id as string).replace("JOB-Q-", "");
      jobLoggedIds.add(num);
      if (!quoteMeta[num]) quoteMeta[num] = {};
      if (!quoteMeta[num].factory_job_status) {
        quoteMeta[num].factory_job_status = j.workflow_status as string;
      }
    }
  }

  const recentQuotientEvents: RecentQuotientEvent[] = (events ?? [])
    .slice(0, 12)
    .map((row) => {
      const payload = row.raw_payload as { title?: string } | null;
      const meta = quoteMeta[row.quotient_id] ?? {};
      return {
        id: row.id,
        quotient_id: row.quotient_id,
        event_name: row.event_name,
        created_at: row.created_at,
        title: payload?.title,
        journey_outcome: meta.journey_outcome ?? "open",
        factory_job_status: meta.factory_job_status ?? null,
        quote_status: meta.quote_status ?? null,
        job_logged: jobLoggedIds.has(row.quotient_id),
      };
    });

  const { data: lowStock, error: invErr } = await supabase
    .from("inventory")
    .select("sku_code, description_1, stock_quantity, reorder_level, reorder_alert")
    .eq("reorder_alert", true)
    .order("stock_quantity", { ascending: true })
    .limit(10);

  if (invErr) throw new Error(invErr.message);

  const inventoryReorderCount = lowStock?.length ?? 0;

  return {
    quotientEvents,
    quotientTotal: events?.length ?? 0,
    recentQuotientEvents,
    inventoryReorderCount,
    inventoryLowStock: (lowStock ?? []).map((r) => ({
      sku_code: r.sku_code,
      description_1: r.description_1,
      stock_quantity: Number(r.stock_quantity),
      reorder_level: Number(r.reorder_level),
    })),
  };
}

