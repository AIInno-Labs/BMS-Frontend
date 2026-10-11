import { NextResponse } from "next/server";
import {
  getJobByNumberFromDb,
  updateJobInDb,
  type JobUpdateAuditAction,
} from "@/lib/supabase/jobs-repository";
import type { Job } from "@/lib/types";

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
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { jobNumber } = await params;
  const id = decodeURIComponent(jobNumber);

  let job: Job;
  let audit: JobUpdateAuditAction = "job_card_saved";
  let auditDetail: string | null | undefined;
  try {
    const raw = (await request.json()) as
      | Job
      | { job: Job; audit?: JobUpdateAuditAction; auditDetail?: string | null };
    if (raw && typeof raw === "object" && "job" in raw && raw.job) {
      job = raw.job;
      if (raw.audit !== undefined) audit = raw.audit;
      if ("auditDetail" in raw) auditDetail = raw.auditDetail;
    } else {
      job = raw as Job;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (job.id !== id) {
    return NextResponse.json({ error: "Job id mismatch" }, { status: 400 });
  }

  try {
    const saved = await updateJobInDb(job, audit, auditDetail);
    return NextResponse.json({ job: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update job";
    console.error("[api/jobs] PATCH", id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
