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
  /**
   * READY alone (a draft marked ready). `/jobs/counts` cannot split it from
   * `ready`, so it is read separately (see `JobsContext`); Ready to Manufacture
   * is `ready - readyOnly`.
   */
  readyOnly: number;
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
  readyOnly: 0,
  manufacturing: 0,
  onHold: 0,
  delivered: 0,
  cancelled: 0,
  authoritative: false,
};

export function countsFromDto(dto: FrpJobCountsDTO, readyOnly = 0): JobCounts {
  return {
    total: dto.total ?? 0,
    active: dto.active ?? 0,
    overdue: dto.overdue ?? 0,
    notStarted: dto.notStarted ?? 0,
    awaitingApproval: dto.awaitingApproval ?? 0,
    ready: dto.ready ?? 0,
    readyOnly: Math.min(readyOnly, dto.ready ?? 0),
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
    readyOnly: by("Ready"),
    manufacturing: by("In Fabrication"),
    onHold: by("On Hold"),
    delivered: by("Complete"),
    cancelled: by("Cancelled"),
    authoritative: false,
  };
}

/**
 * The Not Started and Manufacturing cards (Jobs page and dashboard tiles).
 * The card lists in `JobsList` (`STAGE_GROUP_BACKEND_STATUSES`) use the same
 * statuses, so a card's number always equals its list:
 *
 *  - Not Started   = Pending + Ready + Awaiting Manager Approval
 *  - Manufacturing = Ready to Manufacture + In Fabrication
 *
 * On Hold and Cancelled are in neither card (they stay under All and their own
 * Stage options). `total` is every job except Cancelled, the divisor for the
 * "% of jobs" figures.
 */
export function stageGroupCounts(counts: JobCounts) {
  const readyToManufacture = Math.max(0, counts.ready - counts.readyOnly);
  const notStarted = counts.notStarted + counts.readyOnly + counts.awaitingApproval;
  const manufacturing = counts.manufacturing + readyToManufacture;
  const delivered = counts.delivered;
  return {
    notStarted,
    manufacturing,
    delivered,
    total: Math.max(1, counts.total - counts.cancelled),
  };
}
