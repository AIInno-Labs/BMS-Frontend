import { NextResponse } from "next/server";
import { fetchAnalyticsSnapshot } from "@/lib/supabase/analytics-repository";

export async function GET() {
  try {
    const snapshot = await fetchAnalyticsSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analytics fetch failed";
    console.error("[api/analytics]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
