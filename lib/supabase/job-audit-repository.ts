import type { JobAuditEntry } from "@/lib/audit/job-audit-types";
import {
  formatAuditWhen,
  quotientEventToAuditEntry,
} from "@/lib/audit/quotient-event-audit";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const JOB_AUDIT_ACTION_LABELS: Record<string, string> = {
  job_card_saved: "Manager: Job Card Downloaded",
  alert_cleared: "Manager: Priority alert cleared",
  ai_estimate: "AI Copilot: Generated material estimates",
  payment_updated: "Manager: Payment status updated",
};

export function parseQuotientIdFromJobId(jobId: string): string | null {
  const m = /^JOB-Q-(.+)$/i.exec(jobId);
  return m?.[1] ?? null;
}

export async function insertJobAuditEntry(
  jobId: string,
  action: string,
  detail?: string | null
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("job_audit_log").insert({
    job_id: jobId,
    action,
    detail: detail ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getJobAuditTrailFromDb(
  jobId: string
): Promise<JobAuditEntry[]> {
  const supabase = createSupabaseAdmin();
  const entries: JobAuditEntry[] = [];

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, workflow_status, alert_message, created_at, updated_at")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) throw new Error(jobErr.message);

  const quotientId = parseQuotientIdFromJobId(jobId);

  if (quotientId) {
    const { data: events, error: evErr } = await supabase
      .from("quote_events_history")
      .select("id, event_name, processing_status, processing_error, created_at")
      .eq("quotient_id", quotientId)
      .order("created_at", { ascending: true });

    if (evErr) throw new Error(evErr.message);
    for (const row of events ?? []) {
      entries.push(quotientEventToAuditEntry(row));
    }
  } else if (job) {
    entries.push({
      id: `job-created-${jobId}`,
      icon: "clock",
      title: "System: Job registered in manufacturing OS",
      timestamp: formatAuditWhen(job.created_at as string),
      at: job.created_at as string,
    });
  }

  const { data: auditRows, error: auditErr } = await supabase
    .from("job_audit_log")
    .select("id, action, detail, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (
    auditErr &&
    !/job_audit_log/i.test(auditErr.message) &&
    auditErr.code !== "42P01"
  ) {
    throw new Error(auditErr.message);
  }

  for (const row of auditRows ?? []) {
    const action = row.action as string;
    let title = JOB_AUDIT_ACTION_LABELS[action] ?? action;
    if (row.detail) {
      title =
        action === "alert_cleared"
          ? "Manager: Priority alert cleared"
          : `${title} — ${row.detail}`;
    }
    entries.push({
      id: `audit-${row.id}`,
      icon: action === "ai_estimate" ? "ai" : "check",
      title,
      timestamp: formatAuditWhen(row.created_at as string),
      at: row.created_at as string,
    });
  }

  if (job?.alert_message) {
    entries.push({
      id: `alert-active-${jobId}`,
      icon: "warn",
      title: `Active alert: ${String(job.alert_message)}`,
      timestamp: formatAuditWhen(job.updated_at as string),
      at: job.updated_at as string,
    });
  }

  entries.sort((a, b) => a.at.localeCompare(b.at));
  return entries;
}
