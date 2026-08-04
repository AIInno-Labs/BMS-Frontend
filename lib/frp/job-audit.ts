import { formatAuditWhen } from "@/lib/audit/quotient-event-audit";
import type { JobAuditEntry } from "@/lib/audit/job-audit-types";
import { listJobAudit } from "@/lib/frp/api";

const JOB_AUDIT_ACTION_LABELS: Record<string, string> = {
  job_card_saved: "Manager: Job Card Saved",
  alert_cleared: "Manager: Priority alert cleared",
  ai_estimate: "AI Copilot: Generated material estimates",
  payment_updated: "Manager: Payment status updated",
  status_changed: "Manager: Status changed",
  assignment_changed: "Manager: Assignment changed",
  qa_signed_off: "QA: Signed off",
  note_added: "Note added",
};

function iconForAction(action: string): JobAuditEntry["icon"] {
  if (action === "ai_estimate") return "ai";
  if (action.includes("alert") || action.includes("fail")) return "warn";
  if (action.includes("qa") || action.includes("signed")) return "check";
  return "clock";
}

export async function getJobAuditTrail(jobNumber: string): Promise<JobAuditEntry[]> {
  const page = await listJobAudit(jobNumber, 0, 100);
  return (page.content ?? []).map((row) => {
    const action = row.action ?? "update";
    let title = JOB_AUDIT_ACTION_LABELS[action] ?? action;
    if (row.detail) {
      title = `${title} — ${row.detail}`;
    }
    if (row.performedBy) {
      title = `${title} (${row.performedBy})`;
    }
    const at = row.performedAt ?? new Date().toISOString();
    return {
      id: row.id != null ? `audit-${row.id}` : `audit-${at}-${action}`,
      icon: iconForAction(action),
      title,
      timestamp: formatAuditWhen(at),
      at,
    };
  });
}
