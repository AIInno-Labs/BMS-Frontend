import { NextResponse } from "next/server";
import { listActiveDirectorsFromDb } from "@/lib/supabase/directors-repository";
import { listJobsFromDb } from "@/lib/supabase/jobs-repository";
import { listStaffFromDb } from "@/lib/supabase/floor-repository";

export async function GET() {
  try {
    const [jobs, staff, directors] = await Promise.all([
      listJobsFromDb(),
      listStaffFromDb().catch(() => []),
      listActiveDirectorsFromDb().catch(() => []),
    ]);
    return NextResponse.json({ jobs, staff, directors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load jobs";
    console.error("[api/jobs] GET", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
