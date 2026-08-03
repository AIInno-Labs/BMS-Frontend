import type { JobStageGroup } from "@/lib/jobStageGroups";

/**
 * Single source of truth for the job status model.
 *
 * The PRD status matrix (tech spec §3.3) defines the forward-looking lifecycle
 * used by the status engine, KPI metrics, and the DEL-07 client email driver.
 * The Supabase `jobs.workflow_status` CHECK constraint still enforces the
 * original seven states, so both sets are modelled here and both render.
 * Canonical statuses become authoritative when the Spring Boot backend lands.
 *
 * Do not hardcode status strings in components — import from this module so the
 * DB enum swap is a single-file change.
 */

/** Ordered lifecycle from the PRD notification matrix. */
export const JOB_STATUSES = [
  "Quoted",
  "Quote Accepted",
  "Drawing – In Progress",
  "Drawing – Approved by Client",
  "Drawing – Engineering Approval",
  "Workshop Notes Compiled",
  "Ready to Manufacture",
  "Manufacturing Complete",
  "Packed",
  "Photographed",
  "Signed by Workshop Staff",
  "QA Approved",
  "Invoiced",
  "Awaiting Delivery / Install / Pickup",
  "Completed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Exception states outside the linear lifecycle.
 *
 * Not present in the PRD matrix, but operationally required: the Quotient
 * `quote_declined` handler already transitions jobs to Cancelled, and On Hold
 * is in active use. Neither triggers a client email.
 */
export const JOB_EXCEPTION_STATUSES = ["On Hold", "Cancelled"] as const;

export type JobExceptionStatus = (typeof JOB_EXCEPTION_STATUSES)[number];

/** Statuses enforced by the current Supabase CHECK constraint. */
export const LEGACY_JOB_STATUSES = [
  "Pending",
  "Awaiting Manager Approval",
  "Ready to Manufacture",
  "In Fabrication",
  "On Hold",
  "Complete",
  "Cancelled",
] as const;

export type LegacyJobStatus = (typeof LEGACY_JOB_STATUSES)[number];

/** Anything persisted today or after the backend migration. */
export type AnyJobStatus = JobStatus | JobExceptionStatus | LegacyJobStatus;

interface JobStatusMeta {
  /** Position in the lifecycle, used for progress and sorting. */
  order: number;
  group: JobStageGroup;
  /** PRD §3.3 — whether reaching this state dispatches a client email. */
  clientEmail: boolean;
  /** Operational meaning, surfaced in tooltips and the status picker. */
  description: string;
}

export const JOB_STATUS_META: Record<JobStatus, JobStatusMeta> = {
  Quoted: {
    order: 0,
    group: "not-started",
    clientEmail: false,
    description: "Quote issued — handled in Quotient prior to job creation.",
  },
  "Quote Accepted": {
    order: 1,
    group: "not-started",
    clientEmail: false,
    description: "Client accepted the quote. Quotient sends its own confirmation.",
  },
  "Drawing – In Progress": {
    order: 2,
    group: "not-started",
    clientEmail: true,
    description: "Drafting has commenced — notifies the client.",
  },
  "Drawing – Approved by Client": {
    order: 3,
    group: "not-started",
    clientEmail: true,
    description: "Client sign-off recorded. Approval email stored as evidence.",
  },
  "Drawing – Engineering Approval": {
    order: 4,
    group: "not-started",
    clientEmail: true,
    description: "Structural/engineering clearance confirmed.",
  },
  "Workshop Notes Compiled": {
    order: 5,
    group: "not-started",
    clientEmail: false,
    description: "Internal milestone — work instructions prepared.",
  },
  "Ready to Manufacture": {
    order: 6,
    group: "manufacturing",
    clientEmail: false,
    description: "Internal milestone — released to the shop floor.",
  },
  "Manufacturing Complete": {
    order: 7,
    group: "manufacturing",
    clientEmail: true,
    description: "Fabrication finished — informs the client.",
  },
  Packed: {
    order: 8,
    group: "manufacturing",
    clientEmail: false,
    description: "Internal milestone — packed for despatch.",
  },
  Photographed: {
    order: 9,
    group: "manufacturing",
    clientEmail: false,
    description: "Internal milestone — workshop photos captured.",
  },
  "Signed by Workshop Staff": {
    order: 10,
    group: "manufacturing",
    clientEmail: false,
    description: "Internal milestone — job card signed off on the floor.",
  },
  "QA Approved": {
    order: 11,
    group: "manufacturing",
    clientEmail: true,
    description: "QA sign-off complete — triggers automated LOC generation.",
  },
  Invoiced: {
    order: 12,
    group: "delivered",
    clientEmail: true,
    description: "Billing event confirmed.",
  },
  "Awaiting Delivery / Install / Pickup": {
    order: 13,
    group: "delivered",
    clientEmail: true,
    description: "Fulfilment scheduled — includes pickup and delivery detail.",
  },
  Completed: {
    order: 14,
    group: "delivered",
    clientEmail: true,
    description: "Job closed — thank-you note and feedback link sent.",
  },
};

const EXCEPTION_STATUS_GROUP: Record<JobExceptionStatus, JobStageGroup> = {
  "On Hold": "not-started",
  Cancelled: "not-started",
};

const LEGACY_STATUS_GROUP: Record<LegacyJobStatus, JobStageGroup> = {
  Pending: "not-started",
  "Awaiting Manager Approval": "not-started",
  "Ready to Manufacture": "manufacturing",
  "In Fabrication": "manufacturing",
  "On Hold": "not-started",
  Complete: "delivered",
  Cancelled: "not-started",
};

/**
 * Legacy → canonical mapping, applied when the DB enum migrates.
 *
 * `null` marks a state whose canonical equivalent is a business decision, not a
 * technical one — these need confirmation before the migration runs:
 *
 * - "Awaiting Manager Approval" has no counterpart in the PRD lifecycle. It is
 *   an internal gate that may map to a drawing-approval state or may need to
 *   survive as its own status.
 * - "In Fabrication" sits between Ready to Manufacture and Manufacturing
 *   Complete, which the PRD models as a transition rather than a resting state.
 */
export const LEGACY_TO_CANONICAL: Record<
  LegacyJobStatus,
  JobStatus | JobExceptionStatus | null
> = {
  Pending: "Quote Accepted",
  "Awaiting Manager Approval": null,
  "Ready to Manufacture": "Ready to Manufacture",
  "In Fabrication": null,
  "On Hold": "On Hold",
  Complete: "Completed",
  Cancelled: "Cancelled",
};

const CANONICAL_SET = new Set<string>(JOB_STATUSES);
const EXCEPTION_SET = new Set<string>(JOB_EXCEPTION_STATUSES);
const LEGACY_SET = new Set<string>(LEGACY_JOB_STATUSES);

export function isCanonicalStatus(status: string): status is JobStatus {
  return CANONICAL_SET.has(status);
}

export function isExceptionStatus(status: string): status is JobExceptionStatus {
  return EXCEPTION_SET.has(status);
}

export function isLegacyStatus(status: string): status is LegacyJobStatus {
  return LEGACY_SET.has(status);
}

/** Resolve any persisted status to a stage group. Unknown values read as not-started. */
export function resolveStatusGroup(status: AnyJobStatus | string): JobStageGroup {
  if (isCanonicalStatus(status)) return JOB_STATUS_META[status].group;
  if (isExceptionStatus(status)) return EXCEPTION_STATUS_GROUP[status];
  if (isLegacyStatus(status)) return LEGACY_STATUS_GROUP[status];
  return "not-started";
}

/** Whether reaching this status dispatches a client email (PRD §3.3). */
export function triggersClientEmail(status: AnyJobStatus | string): boolean {
  return isCanonicalStatus(status) ? JOB_STATUS_META[status].clientEmail : false;
}

/** Statuses that dispatch a client email, in lifecycle order. */
export const CLIENT_EMAIL_STATUSES: JobStatus[] = JOB_STATUSES.filter(
  (status) => JOB_STATUS_META[status].clientEmail
);

/** Lifecycle completion as a 0–100 percentage. Exception states report 0. */
export function statusProgressPercent(status: AnyJobStatus | string): number {
  if (!isCanonicalStatus(status)) return 0;
  const { order } = JOB_STATUS_META[status];
  return Math.round((order / (JOB_STATUSES.length - 1)) * 100);
}

/** Human-readable description, safe for unknown values. */
export function statusDescription(status: AnyJobStatus | string): string {
  return isCanonicalStatus(status) ? JOB_STATUS_META[status].description : "";
}

/** Every selectable status, lifecycle order first, then exception states. */
export const ALL_SELECTABLE_STATUSES: AnyJobStatus[] = [
  ...JOB_STATUSES,
  ...JOB_EXCEPTION_STATUSES,
];
