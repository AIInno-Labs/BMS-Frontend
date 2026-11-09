/**
 * Org-wide job counts.
 *
 * The authority is `GET /jobs/counts` (`JobCountsDTO`), which aggregates in the
 * database across the whole organization. Counting the loaded `jobs` array
 * instead only ever counted one page — the list is capped at 200 — so every
 * dashboard tile silently under-reported as soon as a tenant passed that many
 * jobs, and the numbers disagreed with the list they sat above.
 *
 * `deriveFromJobs` exists purely as a fallback for when the endpoint is
 * unavailable (an older backend, or a role without `JOB_READ`), so tiles show
 * something defensible rather than zeros.
 */

import type { FrpJobCountsDTO } from "@/lib/frp/job-mapper";
import type { Job } from "@/lib/types";

export interface JobCounts {
  total: number;
  /** Neither COMPLETE nor CANCELLED. */
  active: number;
  /** Past due and still open. */
  overdue: number;
  notStarted: number;
  awaitingApproval: number;
  ready: number;
  manufacturing: number;
  onHold: number;
  delivered: number;
  cancelled: number;
  /**
   * True when these came from `/jobs/counts`. False means they were derived
   * from the loaded page and are a floor, not a total.
   */
  authoritative: boolean;
}

export const EMPTY_JOB_COUNTS: JobCounts = {
  total: 0,
  active: 0,
  overdue: 0,
  notStarted: 0,
  awaitingApproval: 0,
  ready: 0,
  manufacturing: 0,
  onHold: 0,
  delivered: 0,
  cancelled: 0,
  authoritative: false,
};

export function countsFromDto(dto: FrpJobCountsDTO): JobCounts {
  return {
    total: dto.total ?? 0,
    active: dto.active ?? 0,
    overdue: dto.overdue ?? 0,
    notStarted: dto.notStarted ?? 0,
    awaitingApproval: dto.awaitingApproval ?? 0,
    ready: dto.ready ?? 0,
    manufacturing: dto.manufacturing ?? 0,
    onHold: dto.onHold ?? 0,
    delivered: dto.delivered ?? 0,
    cancelled: dto.cancelled ?? 0,
    authoritative: true,
  };
}

function isActive(job: Job): boolean {
  return job.status !== "Complete" && job.status !== "Cancelled";
}

/** Fallback only — see the module note. */
export function deriveFromJobs(jobs: Job[]): JobCounts {
  const now = Date.now();
  const by = (status: string) => jobs.filter((j) => j.status === status).length;

  return {
    total: jobs.length,
    active: jobs.filter(isActive).length,
    overdue: jobs.filter((j) => {
      if (!isActive(j) || !j.dueDate) return false;
      const due = new Date(j.dueDate).getTime();
      return Number.isFinite(due) && due < now;
    }).length,
    notStarted: by("Pending"),
    awaitingApproval: by("Awaiting Manager Approval"),
    ready: by("Ready to Manufacture"),
    manufacturing: by("In Fabrication"),
    onHold: by("On Hold"),
    delivered: by("Complete"),
    cancelled: by("Cancelled"),
    authoritative: false,
  };
}

/**
 * The three buckets the dashboard donut and the jobs stage cards share.
 *
 * `manufacturing` folds in `ready`, and `notStarted` folds in the approval gate
 * and on-hold, matching `lib/jobStageGroups.ts`.
 */
export function stageGroupCounts(counts: JobCounts) {
  const notStarted = counts.notStarted + counts.awaitingApproval + counts.onHold;
  const manufacturing = counts.manufacturing + counts.ready;
  const delivered = counts.delivered;
  return {
    notStarted,
    manufacturing,
    delivered,
    total: Math.max(1, notStarted + manufacturing + delivered),
  };
}
