import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

function authorizeWebhook(request: Request): boolean {
  const secret = process.env.QUOTIENT_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const headerSecret = request.headers.get("x-webhook-secret")?.trim();
  return bearer === secret || headerSecret === secret;
}

/**
 * Phase 1 only: validate → insert raw JSONB → HTTP 200.
 * Phase 2 runs inside PostgreSQL via AFTER INSERT trigger on quote_events_history.
 * Quotient three-strike policy: https://www.quotientapp.com/help/quotient-webhooks
 */
export async function POST(request: Request) {
  /**
  if (!authorizeWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  */

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event_name = typeof body.event_name === "string" ? body.event_name : "";
  const quotient_id = String(
    body.quote_number ?? body.quotient_id ?? ""
  ).trim();

  if (!event_name || !quotient_id) {
    return NextResponse.json(
      { error: "Required: event_name and quote_number (quotient_id)" },
      { status: 400 }
    );
  }

  const { error } = await createSupabaseAdmin()
    .from("quote_events_history")
    .insert({
      quotient_id,
      event_name,
      raw_payload: body,
      processing_status: "received",
    });

  if (error) {
    console.error("[quotient-webhook] insert failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: 200 }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({
    service: "FRP Engineering Quotient Webhook",
    phase_1: "POST — archive raw_payload → 200 OK immediately",
    phase_2: "PostgreSQL AFTER INSERT trigger — process_quotient_webhook_payload()",
    auth: "Authorization: Bearer <QUOTIENT_WEBHOOK_SECRET> or x-webhook-secret",
    documentation: "https://www.quotientapp.com/help/quotient-webhooks",
  });
}
