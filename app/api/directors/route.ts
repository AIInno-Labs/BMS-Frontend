import { NextResponse } from "next/server";
import { listActiveDirectorsFromDb } from "@/lib/supabase/directors-repository";

export async function GET() {
  try {
    const directors = await listActiveDirectorsFromDb();
    return NextResponse.json({ directors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load directors";
    console.error("[api/directors] GET", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
