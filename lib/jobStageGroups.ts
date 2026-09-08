import type { Job } from "@/lib/types";
import {
  JOB_STATUSES,
  JOB_STATUS_META,
  resolveStatusGroup,
  type AnyJobStatus,
  type JobStatus,
} from "@/lib/jobStatus";

export type JobStageGroup = "delivered" | "manufacturing" | "not-started";

export function getJobStageGroup(job: Job): JobStageGroup {
  return resolveStatusGroup(job.status);
}

export function jobMatchesStageGroup(job: Job, group: JobStageGroup): boolean {
  return getJobStageGroup(job) === group;
}

export function filterJobsByStageGroup(jobs: Job[], group: JobStageGroup): Job[] {
  return jobs.filter((job) => jobMatchesStageGroup(job, group));
}

/** Canonical lifecycle statuses belonging to a stage group, in order. */
function canonicalStatusesFor(group: JobStageGroup): JobStatus[] {
  return JOB_STATUSES.filter((status) => JOB_STATUS_META[status].group === group);
}

export const STAGE_GROUP_INFO: Record<
  JobStageGroup,
  {
    label: string;
    headline: string;
    description: string;
    statuses: AnyJobStatus[];
  }
> = {
  delivered: {
    label: "Delivered",
    headline: "Completed programs",
    description:
      "Fabrication finished — invoiced, awaiting fulfilment, or closed out.",
    statuses: canonicalStatusesFor("delivered"),
  },
  manufacturing: {
    label: "Manufacturing",
    headline: "Active fabrication",
    description:
      "Released to the shop floor — in production through to QA sign-off.",
    statuses: canonicalStatusesFor("manufacturing"),
  },
  "not-started": {
    label: "Not Started",
    headline: "Pre-production queue",
    description:
      "Quoting, drawings, and approvals — not yet released to manufacturing.",
    statuses: canonicalStatusesFor("not-started"),
  },
};

export function parseStageGroupParam(
  value: string | null | undefined
): JobStageGroup | null {
  if (
    value === "delivered" ||
    value === "manufacturing" ||
    value === "not-started"
  ) {
    return value;
  }
  return null;
}
