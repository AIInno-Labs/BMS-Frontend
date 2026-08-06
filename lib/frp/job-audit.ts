import { formatAuditWhen } from "@/lib/audit/quotient-event-audit";
import type { JobAuditEntry } from "@/lib/audit/job-audit-types";
import { listJobAudit } from "@/lib/frp/api";
import { statusToUi } from "@/lib/frp/job-status";

/**
 * `JobAuditHistory.eventCode` — the business timeline, distinct from the
 * HTTP-level `AuditLog`. Values come from `com.argus.frp.Enum.JobAuditEvent`.
 *
 * The previous labels keyed off a lowercase `action` field that the backend
 * never sends; every row rendered as its own raw key.
 */
const JOB_AUDIT_EVENT_LABELS: Record<string, string> = {
  JOB_CREATED: "Job created",
  STATUS_CHANGED: "Status changed",
  JOB_CARD_SAVED: "Job card saved",
  JOB_CARD_DOWNLOADED: "Job card downloaded",
  STAGE_COMPLETED: "Stage completed",
  WORKER_ASSIGNED: "Worker assigned",
  PAYMENT_RECORDED: "Payment recorded",
  DOCUMENT_UPLOADED: "Document uploaded",
  JOB_CANCELLED: "Job cancelled",
  INVENTORY_CHANGED: "Inventory changed",
  DRAWING_STAGE_CHANGED: "Drawing stage",
  REQUIREMENT_CHANGED: "Requirement",
};

function iconForEvent(code: string): JobAuditEntry["icon"] {
  if (code === "JOB_CANCELLED") return "warn";
  if (code === "STAGE_COMPLETED" || code === "JOB_CARD_SAVED") return "check";
  return "clock";
}

/**
 * Flatten the structured `detail` map into a readable clause.
 *
 * The backend stores `Map<String,Object>` — e.g. `{"stageKey": "production",
 * "via": "scan"}` — not a string, so it is rendered rather than dropped.
 */
function describeDetail(detail?: Record<string, unknown> | null): string {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
}

/**
 * @param dbId Spring Boot job primary key. The route is
 *   `GET /jobs/{id}/audit` with a numeric path variable, not the job number.
 */
export async function getJobAuditTrail(
  dbId: string | number
): Promise<JobAuditEntry[]> {
  const page = await listJobAudit(dbId, 0, 100);
  return (page.content ?? []).map((row) => {
    const code = row.eventCode ?? "UPDATED";
    let title = JOB_AUDIT_EVENT_LABELS[code] ?? code;

    if (row.statusFrom || row.statusTo) {
      const from = row.statusFrom ? statusToUi(row.statusFrom) : "—";
      const to = row.statusTo ? statusToUi(row.statusTo) : "—";
      title = `${title}: ${from} → ${to}`;
    }

    const detail = describeDetail(row.detail);
    if (detail) title = `${title} — ${detail}`;

    if (row.actor) {
      title = row.actorRole
        ? `${title} (${row.actor}, ${row.actorRole})`
        : `${title} (${row.actor})`;
    }

    const at = row.occurredAt ?? new Date().toISOString();
    return {
      id: row.id != null ? `audit-${row.id}` : `audit-${at}-${code}`,
      icon: iconForEvent(code),
      title,
      timestamp: formatAuditWhen(at),
      at,
    };
  });
}
