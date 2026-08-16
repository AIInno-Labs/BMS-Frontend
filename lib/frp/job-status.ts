/**
 * Translation between the backend's stored vocabulary and the UI's display
 * vocabulary.
 *
 * The backend (`com.argus.frp.Enum.JobStatus`, pinned by the `ck_job_status`
 * CHECK constraint in migration V3) stores seven SCREAMING_SNAKE values. The
 * build spec — `frp/docs/domain-schema-api.html` Rev 2 §7.1 — rules that
 * "the prototype's display strings ('Ready to Manufacture') become a
 * presentation concern, not a stored value".
 *
 * This module is that presentation layer. It is the only place either
 * vocabulary is spelled out; nothing else in the app should translate status,
 * priority, resin or origin.
 */

import type { JobPriority, ResinType } from "@/lib/types";
import type { LegacyJobStatus } from "@/lib/jobStatus";
import { isCanonicalStatus, JOB_STATUS_META } from "@/lib/jobStatus";

/* ------------------------------------------------------------------ status */

/** Exactly the backend `JobStatus` enum. */
export const BACKEND_JOB_STATUSES = [
  "PENDING",
  "AWAITING_MANAGER_APPROVAL",
  "READY_TO_MANUFACTURE",
  "IN_FABRICATION",
  "ON_HOLD",
  "COMPLETE",
  "CANCELLED",
] as const;

export type BackendJobStatus = (typeof BACKEND_JOB_STATUSES)[number];

/**
 * Backend enum → the display label components already use.
 *
 * These are the seven strings in `LEGACY_JOB_STATUSES`, which every component
 * (`Dashboard`, `JobsList`, `AnalyticsPage`, `FactoryCommandPanel`, …) already
 * compares against — so the mapping is 1:1 and no component needed changing.
 */
const STATUS_TO_LABEL: Record<BackendJobStatus, LegacyJobStatus> = {
  PENDING: "Pending",
  AWAITING_MANAGER_APPROVAL: "Awaiting Manager Approval",
  READY_TO_MANUFACTURE: "Ready to Manufacture",
  IN_FABRICATION: "In Fabrication",
  ON_HOLD: "On Hold",
  COMPLETE: "Complete",
  CANCELLED: "Cancelled",
};

const LABEL_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS_TO_LABEL).map(([code, label]) => [label, code])
) as Record<LegacyJobStatus, BackendJobStatus>;

/**
 * The 15 PRD lifecycle labels collapse onto the seven stored states.
 *
 * Many-to-one by design: the PRD lifecycle is a *notification* model (which
 * transitions email the client), not a storage model. Derived from
 * `JOB_STATUS_META[...].group` so it cannot drift from `lib/jobStatus.ts`.
 */
function canonicalToBackend(label: string): BackendJobStatus | null {
  if (!isCanonicalStatus(label)) return null;
  const { group, order } = JOB_STATUS_META[label];
  if (group === "delivered") return order >= 14 ? "COMPLETE" : "IN_FABRICATION";
  if (group === "manufacturing") {
    return label === "Ready to Manufacture"
      ? "READY_TO_MANUFACTURE"
      : "IN_FABRICATION";
  }
  return "PENDING";
}

const BACKEND_SET = new Set<string>(BACKEND_JOB_STATUSES);

/** Backend value → UI label. Unknown input reads as `Pending`. */
export function statusToUi(value?: string | null): LegacyJobStatus {
  if (!value) return "Pending";
  const trimmed = value.trim();
  if (BACKEND_SET.has(trimmed)) {
    return STATUS_TO_LABEL[trimmed as BackendJobStatus];
  }
  const asEnum = trimmed.toUpperCase().replace(/\s+/g, "_");
  if (BACKEND_SET.has(asEnum)) {
    return STATUS_TO_LABEL[asEnum as BackendJobStatus];
  }
  if (trimmed in LABEL_TO_STATUS) {
    return trimmed as LegacyJobStatus;
  }
  return "Pending";
}

/** Terminal cancel — the job must not be edited. */
export function isCancelledJob(status?: string | null): boolean {
  return statusToUi(status) === "Cancelled";
}

/**
 * UI label → backend value. Accepts a display label, a PRD lifecycle label, or
 * a raw enum name. Returns null when nothing matches, so callers can decide
 * between defaulting and failing — never guess silently.
 */
export function statusToBackend(value?: string | null): BackendJobStatus | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (BACKEND_SET.has(trimmed)) return trimmed as BackendJobStatus;
  if (trimmed in LABEL_TO_STATUS) {
    return LABEL_TO_STATUS[trimmed as LegacyJobStatus];
  }
  return canonicalToBackend(trimmed);
}

/**
 * The milestone `stageKey` that has to move for a job to reach a status.
 *
 * `JobStageServiceImpl.recomputeJobStatus` derives `job.stageStatus` from the
 * furthest-progressed milestone — it is a cache with exactly one writer, and
 * the job endpoint refuses to set it. So a status change is a *stage* change.
 * `null` means the target is not reachable by advancing a stage:
 * `CANCELLED` goes through `DELETE /jobs/{id}`, and `ON_HOLD` needs a stage
 * blocked rather than completed.
 */
export const STATUS_TARGET_STAGE: Record<
  BackendJobStatus,
  { stageKey: string; status: "IN_PROGRESS" | "COMPLETE" | "BLOCKED" } | null
> = {
  PENDING: { stageKey: "draft", status: "IN_PROGRESS" },
  AWAITING_MANAGER_APPROVAL: { stageKey: "approval", status: "IN_PROGRESS" },
  READY_TO_MANUFACTURE: { stageKey: "approval", status: "COMPLETE" },
  IN_FABRICATION: { stageKey: "production", status: "IN_PROGRESS" },
  COMPLETE: { stageKey: "completed", status: "COMPLETE" },
  ON_HOLD: { stageKey: "production", status: "BLOCKED" },
  CANCELLED: null,
};

/* ---------------------------------------------------------------- priority */

const PRIORITY_TO_UI: Record<string, JobPriority> = {
  NORMAL: "Normal",
  HIGH: "High",
  RUSH: "RUSH",
};

const PRIORITY_TO_BACKEND: Record<JobPriority, string> = {
  Normal: "NORMAL",
  High: "HIGH",
  RUSH: "RUSH",
};

/** Backend value → UI label. Was silently downgrading `HIGH` to `Normal`. */
export function priorityToUi(value?: string | null): JobPriority {
  if (!value) return "Normal";
  return PRIORITY_TO_UI[value.trim().toUpperCase()] ?? "Normal";
}

/** UI label → backend enum name. Jackson binding is case-sensitive. */
export function priorityToBackend(value?: JobPriority | string | null): string {
  if (!value) return "NORMAL";
  const direct = PRIORITY_TO_BACKEND[value as JobPriority];
  if (direct) return direct;
  const upper = String(value).trim().toUpperCase();
  return upper in PRIORITY_TO_UI ? upper : "NORMAL";
}

/* ------------------------------------------------------------------- resin */

/**
 * `resin_code` values seeded by migration V7. The catalogue exists because the
 * same three resins were spelled three ways across jobs, certifications and
 * SKUs, and certification gates who may be assigned a job.
 */
const RESIN_TO_UI: Record<string, ResinType> = {
  ISO: "Isophthalic Polyester",
  VE: "Vinyl Ester",
  PHEN: "Phenolic",
};

const RESIN_TO_BACKEND: Record<ResinType, string> = {
  "Isophthalic Polyester": "ISO",
  "Vinyl Ester": "VE",
  Phenolic: "PHEN",
};

export function resinToUi(code?: string | null): ResinType {
  if (!code) return "Isophthalic Polyester";
  return RESIN_TO_UI[code.trim().toUpperCase()] ?? "Isophthalic Polyester";
}

export function resinToBackend(value?: ResinType | string | null): string {
  if (!value) return "ISO";
  return RESIN_TO_BACKEND[value as ResinType] ?? "ISO";
}

/* ------------------------------------------------------------------ origin */

export type JobOrigin = "QUOTE" | "FACTORY";

/* ---------------------------------------------------------------- job type */

/** Exactly the backend `JobType` enum (`ck_job_type`). */
export const BACKEND_JOB_TYPES = [
  "STANDARD_FABRICATION",
  "CUSTOM_STRUCTURE",
  "GRATING_SUPPLY",
  "HANDRAIL_LADDER",
  "REPAIR_REFIT",
] as const;

export type BackendJobType = (typeof BACKEND_JOB_TYPES)[number];

export const JOB_TYPE_LABELS = [
  "Standard fabrication",
  "Custom structure",
  "Grating supply",
  "Handrail / ladder",
  "Repair / refit",
] as const;

export type JobTypeLabel = (typeof JOB_TYPE_LABELS)[number];

const JOB_TYPE_TO_LABEL: Record<BackendJobType, JobTypeLabel> = {
  STANDARD_FABRICATION: "Standard fabrication",
  CUSTOM_STRUCTURE: "Custom structure",
  GRATING_SUPPLY: "Grating supply",
  HANDRAIL_LADDER: "Handrail / ladder",
  REPAIR_REFIT: "Repair / refit",
};

const LABEL_TO_JOB_TYPE = Object.fromEntries(
  Object.entries(JOB_TYPE_TO_LABEL).map(([code, label]) => [label, code])
) as Record<JobTypeLabel, BackendJobType>;

const BACKEND_JOB_TYPE_SET = new Set<string>(BACKEND_JOB_TYPES);

/** Backend enum → display label. Null when the job predates the field. */
export function jobTypeToUi(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (BACKEND_JOB_TYPE_SET.has(trimmed)) {
    return JOB_TYPE_TO_LABEL[trimmed as BackendJobType];
  }
  if (trimmed in LABEL_TO_JOB_TYPE) return trimmed;
  return null;
}

/** Display label or enum name → backend enum. Null when unset or unknown. */
export function jobTypeToBackend(value?: string | null): BackendJobType | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (BACKEND_JOB_TYPE_SET.has(trimmed)) return trimmed as BackendJobType;
  if (trimmed in LABEL_TO_JOB_TYPE) {
    return LABEL_TO_JOB_TYPE[trimmed as JobTypeLabel];
  }
  return null;
}
