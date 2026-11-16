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
  /** READY and READY_TO_MANUFACTURE together - the backend merges them. */
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
    ready: by("Ready") + by("Ready to Manufacture"),
    manufacturing: by("In Fabrication"),
    onHold: by("On Hold"),
    delivered: by("Complete"),
    cancelled: by("Cancelled"),
    authoritative: false,
  };
}

/**
 * The Not Started and Manufacturing cards (Jobs page and dashboard tiles).
 * Both are the backend's own numbers, and a card's number always equals the
 * list you get when you click it:
 *
 *  - Not Started   = `notStarted` (PENDING). The card opens the Jobs list with
 *                    the Stage filter on Pending.
 *  - Manufacturing = `manufacturing` (IN_FABRICATION). The card opens the Jobs
 *                    list with the Stage filter on In Fabrication.
 *
 * `total` is every job except Cancelled, the divisor for the "% of jobs" figures.
 */
export function stageGroupCounts(counts: JobCounts) {
  const notStarted = counts.notStarted;
  const manufacturing = counts.manufacturing;
  const delivered = counts.delivered;
  return {
    notStarted,
    manufacturing,
    delivered,
    total: Math.max(1, counts.total - counts.cancelled),
  };
}
