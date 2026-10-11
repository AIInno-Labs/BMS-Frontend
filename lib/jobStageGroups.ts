import type { Job, JobStatus } from "@/lib/types";

export type JobStageGroup = "delivered" | "manufacturing" | "not-started";

export function getJobStageGroup(job: Job): JobStageGroup {
  if (job.status === "Complete") return "delivered";
  if (
    job.status === "In Fabrication" ||
    job.status === "Ready to Manufacture"
  ) {
    return "manufacturing";
  }
  return "not-started";
}

export function jobMatchesStageGroup(job: Job, group: JobStageGroup): boolean {
  return getJobStageGroup(job) === group;
}

export function filterJobsByStageGroup(jobs: Job[], group: JobStageGroup): Job[] {
  return jobs.filter((job) => jobMatchesStageGroup(job, group));
}

export const STAGE_GROUP_INFO: Record<
  JobStageGroup,
  {
    label: string;
    headline: string;
    description: string;
    statuses: JobStatus[];
  }
> = {
  delivered: {
    label: "Delivered",
    headline: "Completed programs",
    description:
      "Jobs marked Complete — fabrication finished and ready for close-out, invoicing, or archive.",
    statuses: ["Complete"],
  },
  manufacturing: {
    label: "Manufacturing",
    headline: "Active fabrication",
    description:
      "Jobs Ready to Manufacture or In Fabrication — scheduled or currently on the shop floor.",
    statuses: ["Ready to Manufacture", "In Fabrication"],
  },
  "not-started": {
    label: "Not Started",
    headline: "Pre-production queue",
    description:
      "Jobs Pending, awaiting manager approval, or On Hold — not yet in active manufacturing.",
    statuses: ["Pending", "Awaiting Manager Approval", "On Hold"],
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
