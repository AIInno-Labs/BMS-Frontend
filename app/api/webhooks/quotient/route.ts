import { NextResponse } from "next/server";

/**
 * Quotient webhook ingestion moves to Spring Boot (DEL-02).
 * Returning 200 keeps Quotient from pausing the webhook endpoint while the
 * migration is unfinished — payload is acknowledged but not persisted here.
 */
export async function POST(request: Request) {
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

  console.warn(
    "[quotient-webhook] Supabase ingest retired — forward to Spring Boot DEL-02",
    { event_name, quotient_id }
  );

  return NextResponse.json({
    ok: true,
    deferred: true,
    message:
      "Webhook accepted. Persistence moves to Spring Boot /webhooks/quotient (DEL-02).",
  });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "quotient-webhook",
    backend: "spring-boot-pending-del-02",
  });
}
