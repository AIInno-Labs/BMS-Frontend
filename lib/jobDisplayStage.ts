/**
 * The one word shown for a job's stage - on the Jobs list chip, the job detail
 * page, the timeline and the Stage filter - so they can never disagree.
 *
 * A job has two things:
 *  - a stored status (Pending, Ready to Manufacture, Awaiting Manager Approval,
 *    In Fabrication, On Hold, Complete, Cancelled), and
 *  - a milestone, `currentStageKey` (draft, design, approval, production, qc,
 *    dispatch, completed) - where the job physically is.
 *
 * Neither alone reads well, so the chip uses whichever is clearer:
 *  - status word where the milestone would mislead: Draft + Mark Ready shows
 *    "Ready"; Production that has not started yet shows "Ready to Manufacture";
 *  - milestone word everywhere else: Drawing, Approval, Production, QC,
 *    Dispatch, Completed.
 *
 * On Hold / Cancelled are not handled here - they stay as their own extra chip
 * next to this one.
 */

import type { BackendJobStatus } from "@/lib/frp/job-status";
import type { Job } from "@/lib/types";

export type JobDisplayStage =
  | "pending"
  | "ready"
  | "drawing"
  | "approval"
  | "readyToManufacture"
  | "production"
  | "qc"
  | "dispatch"
  | "completed";

type StageInput = {
  status: Job["status"];
  currentStageKey?: string | null;
  isReady?: boolean | null;
};

export function jobDisplayStage(job: StageInput): JobDisplayStage {
  const { status } = job;
  if (status === "Complete") return "completed";

  // Mark Ready flips the stored status to Ready to Manufacture. `isReady` also
  // counts when a stale PENDING status has not been synced yet.
  const ready =
    status === "Ready to Manufacture" ||
    (job.isReady === true && status === "Pending");

  switch (job.currentStageKey) {
    case "draft":
      return ready ? "ready" : "pending";
    case "design":
      return "drawing";
    case "approval":
      return "approval";
    case "production":
      return ready ? "readyToManufacture" : "production";
    case "qc":
      return "qc";
    case "dispatch":
      return "dispatch";
    case "completed":
      return "completed";
    default:
      // No milestone saved (older jobs): fall back to the stored status word.
      if (ready) return "ready";
      if (status === "Awaiting Manager Approval") return "approval";
      if (status === "In Fabrication") return "production";
      return "pending";
  }
}

const FULL_LABEL: Record<JobDisplayStage, string> = {
  pending: "Pending",
  ready: "Ready",
  drawing: "Drawing",
  approval: "Approval",
  readyToManufacture: "Ready to Manufacture",
  production: "Production",
  qc: "QC",
  dispatch: "Dispatch",
  completed: "Completed",
};

/** Compact form for the narrow list layout. */
const SHORT_LABEL: Record<JobDisplayStage, string> = {
  ...FULL_LABEL,
  readyToManufacture: "Ready",
  completed: "Done",
};

export function jobStageChipLabel(
  job: StageInput,
  variant: "full" | "short" = "full"
): string {
  const stage = jobDisplayStage(job);
  return variant === "full" ? FULL_LABEL[stage] : SHORT_LABEL[stage];
}

/**
 * Status text for the job detail page: the chip word above, except On Hold and
 * Cancelled, which show as themselves (as they always have there).
 */
export function jobStatusText(job: StageInput): string {
  if (job.status === "On Hold" || job.status === "Cancelled") return job.status;
  return jobStageChipLabel(job, "full");
}

/* -------------------------------------------------------------- Stage filter */

/**
 * Stage-dropdown options that are decided by the chip rule above rather than by
 * the stored status alone. (In Fabrication and Delivered stay plain stored-status
 * filters and are not listed here.)
 */
export type StageFilterKey = "pending" | "drawing" | "approval" | "ready";

export function parseStageFilterParam(
  value: string | null | undefined
): StageFilterKey | null {
  return value === "pending" ||
    value === "drawing" ||
    value === "approval" ||
    value === "ready"
    ? value
    : null;
}

/** Older links (dashboard tiles) pass `?status=...` - map them to the same filter. */
export function stageFilterFromLegacyStatus(
  status: string | null | undefined
): StageFilterKey | null {
  if (status === "Pending") return "pending";
  if (status === "Awaiting Manager Approval") return "approval";
  if (status === "Ready to Manufacture") return "ready";
  return null;
}

/**
 * Stored statuses that can contain each filter's jobs. The backend filters by
 * status only, so these are fetched and then narrowed by milestone with
 * {@link jobMatchesStageFilter}. On Hold and Cancelled are never requested, so
 * they stay out of these lists (they remain visible under All).
 */
export const STAGE_FILTER_BACKEND_STATUSES: Record<StageFilterKey, BackendJobStatus[]> = {
  pending: ["PENDING"],
  drawing: ["PENDING", "READY_TO_MANUFACTURE"],
  approval: ["AWAITING_MANAGER_APPROVAL", "READY_TO_MANUFACTURE"],
  ready: ["READY_TO_MANUFACTURE", "PENDING"],
};

/** True when the job's chip belongs to this filter option. */
export function jobMatchesStageFilter(job: StageInput, key: StageFilterKey): boolean {
  const stage = jobDisplayStage(job);
  switch (key) {
    case "pending":
      return stage === "pending";
    case "drawing":
      return stage === "drawing";
    case "approval":
      return stage === "approval";
    case "ready":
      return stage === "ready" || stage === "readyToManufacture";
  }
}
