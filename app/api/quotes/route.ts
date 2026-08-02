import { NextResponse } from "next/server";
import { listQuotesFromDb } from "@/lib/supabase/quotes-repository";

export async function GET() {
  try {
    const quotes = await listQuotesFromDb();
    return NextResponse.json({ quotes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load quotes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
