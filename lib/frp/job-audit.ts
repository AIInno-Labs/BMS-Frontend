import { formatAuditWhen } from "@/lib/audit/quotient-event-audit";
import type { JobAuditEntry } from "@/lib/audit/job-audit-types";
import { listJobAudit } from "@/lib/frp/api";
import type { FrpJobAuditHistoryDTO } from "@/lib/frp/job-mapper";
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
  LOC_EXPORTED: "Letter of Compliance exported",
  STAGE_COMPLETED: "Stage completed",
  WORKER_ASSIGNED: "Worker assigned",
  DUE_DATE_CHANGED: "Due date changed",
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
 * Field diffs are stored as `{ from, to }` objects — not bare scalars — so
 * those must be expanded (`8 → 9`) rather than `String(obj)` → `[object Object]`.
 */
function formatDetailValue(value: unknown): string {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if ("from" in rec || "to" in rec) {
      const from =
        rec.from == null || rec.from === "null" || rec.from === ""
          ? "—"
          : String(rec.from);
      const to =
        rec.to == null || rec.to === "null" || rec.to === ""
          ? "—"
          : String(rec.to);
      return `${from} → ${to}`;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

/** `assignedUserId: 9 (frp User, MANAGER)` when name/role were stored with the event. */
function formatAssignedUserDetail(
  value: unknown,
  detail: Record<string, unknown>
): string {
  const name =
    (typeof detail.displayName === "string" && detail.displayName.trim()) ||
    (typeof detail.assignedUserName === "string" &&
      detail.assignedUserName.trim()) ||
    "";
  const role =
    (typeof detail.role === "string" && detail.role.trim()) ||
    (typeof detail.assignedUserRole === "string" &&
      detail.assignedUserRole.trim()) ||
    "";
  const who = [name, role].filter(Boolean).join(", ");

  if (typeof value === "object" && value != null) {
    const base = formatDetailValue(value);
    return who ? `${base} (${who})` : base;
  }
  const id = String(value);
  return who ? `${id} (${who})` : id;
}

function describeDetail(detail?: Record<string, unknown> | null): string {
  if (!detail) return "";
  const skip = new Set([
    "displayName",
    "role",
    "assignedUserName",
    "assignedUserRole",
  ]);
  return Object.entries(detail)
    .filter(([k, v]) => v != null && v !== "" && !skip.has(k))
    .map(([k, v]) =>
      k === "assignedUserId"
        ? `assignedUserId: ${formatAssignedUserDetail(v, detail)}`
        : `${k}: ${formatDetailValue(v)}`
    )
    .join(", ");
}

/** Prefer resolved display name; fall back to raw actor (id or machine label). */
function actorLabel(row: FrpJobAuditHistoryDTO): string | null {
  const user = row.actorUser;
  if (user) {
    const name =
      user.displayName?.trim() ||
      user.username?.trim() ||
      (user.id != null ? String(user.id) : "");
    if (name) return name;
  }
  const raw = row.actor?.trim();
  return raw || null;
}

/** Assignee shown as a person: `frp User (MANAGER)`. */
function formatAssigneePerson(detail: Record<string, unknown>): string | null {
  const name =
    (typeof detail.displayName === "string" && detail.displayName.trim()) ||
    (typeof detail.assignedUserName === "string" &&
      detail.assignedUserName.trim()) ||
    "";
  const role =
    (typeof detail.role === "string" && detail.role.trim()) ||
    (typeof detail.assignedUserRole === "string" &&
      detail.assignedUserRole.trim()) ||
    "";
  if (name && role) return `${name} (${role})`;
  if (name) return name;

  const id = detail.assignedUserId;
  if (id == null || id === "") return null;
  if (typeof id === "object") return formatDetailValue(id);
  return `user ${id}`;
}

function mapAuditRow(row: FrpJobAuditHistoryDTO): JobAuditEntry {
  const code = row.eventCode ?? "UPDATED";
  let title = JOB_AUDIT_EVENT_LABELS[code] ?? code;

  if (row.statusFrom || row.statusTo) {
    const from = row.statusFrom ? statusToUi(row.statusFrom) : "—";
    const to = row.statusTo ? statusToUi(row.statusTo) : "—";
    title = `${title}: ${from} → ${to}`;
  }

  const detail = describeDetail(row.detail);
  if (code === "DUE_DATE_CHANGED" && row.detail) {
    const from =
      row.detail.from != null && row.detail.from !== ""
        ? String(row.detail.from)
        : null;
    const to =
      row.detail.to != null && row.detail.to !== ""
        ? String(row.detail.to)
        : "not set";
    title = from == null ? `${title}: set to ${to}` : `${title}: ${from} → ${to}`;
  } else if (code === "WORKER_ASSIGNED" && row.detail) {
    // "to X by Y" — not "— X (Y)" which looks like two assignees.
    const assignee = formatAssigneePerson(row.detail);
    if (assignee) title = `${title} to ${assignee}`;
  } else if (detail) {
    title = `${title} — ${detail}`;
  }

  const who = actorLabel(row);
  if (who) {
    if (code === "WORKER_ASSIGNED") {
      title = `${title} by ${who}`;
    } else {
      title = row.actorRole
        ? `${title} (${who}, ${row.actorRole})`
        : `${title} (${who})`;
    }
  }

  const at = row.occurredAt ?? new Date().toISOString();
  return {
    id: row.id != null ? `audit-${row.id}` : `audit-${at}-${code}`,
    icon: iconForEvent(code),
    title,
    timestamp: formatAuditWhen(at),
    at,
  };
}

export type JobAuditTrailPage = {
  entries: JobAuditEntry[];
  totalElements: number;
  hasMore: boolean;
};

/**
 * Paginated audit fetch for job-card timeline (newest first).
 *
 * @param dbId Spring Boot job primary key — `GET /jobs/{id}/audit`.
 */
export async function getJobAuditTrailPage(
  dbId: string | number,
  page: number,
  size: number
): Promise<JobAuditTrailPage> {
  const res = await listJobAudit(dbId, page, size);
  const entries = (res.content ?? []).map(mapAuditRow);
  const totalElements = res.totalElements ?? entries.length;
  const loaded = (page + 1) * size;
  return {
    entries,
    totalElements,
    hasMore: loaded < totalElements,
  };
}

/**
 * @param dbId Spring Boot job primary key. The route is
 *   `GET /jobs/{id}/audit` with a numeric path variable, not the job number.
 */
export async function getJobAuditTrail(
  dbId: string | number
): Promise<JobAuditEntry[]> {
  const { entries } = await getJobAuditTrailPage(dbId, 0, 100);
  return entries;
}

/** Job-card footer version: total rows on GET /jobs/{id}/audit (job events only). */
export async function getJobAuditCount(dbId: string | number): Promise<number> {
  const page = await listJobAudit(dbId, 0, 1);
  return page.totalElements ?? 0;
}

/** Initial audit rows shown before "Show more" — 5 on narrow screens, 8 from sm up. */
export function auditTrailPageSize(): number {
  if (typeof window === "undefined") return 8;
  return window.matchMedia("(min-width: 640px)").matches ? 8 : 5;
}
