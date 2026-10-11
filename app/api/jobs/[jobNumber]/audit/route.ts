import { NextResponse } from "next/server";
import { getJobAuditTrailFromDb } from "@/lib/supabase/job-audit-repository";
import { getJobByNumberFromDb } from "@/lib/supabase/jobs-repository";

interface RouteParams {
  params: Promise<{ jobNumber: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { jobNumber } = await params;
  const id = decodeURIComponent(jobNumber);

  try {
    const job = await getJobByNumberFromDb(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const entries = await getJobAuditTrailFromDb(id);
    return NextResponse.json({ entries });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load audit trail";
    console.error("[api/jobs/audit]", id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
