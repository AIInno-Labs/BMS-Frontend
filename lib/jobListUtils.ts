import type { Job } from "@/lib/types";

export const JOBS_PAGE_SIZE = 10;

/** Below this many characters, a job search is too broad to be worth a
 *  request — the navbar box won't commit it and JobsList treats it as no
 *  search. */
export const MIN_JOB_SEARCH_LENGTH = 3;

export type JobSortOption =
  | "created_desc"
  | "created_asc"
  | "due_asc"
  | "due_desc"
  | "job_id_desc"
  | "job_id_asc";

export const JOB_SORT_LABELS: Record<JobSortOption, string> = {
  created_desc: "Created date (newest first)",
  created_asc: "Created date (oldest first)",
  due_asc: "Due date (soonest)",
  due_desc: "Due date (latest)",
  job_id_desc: "Job ID (high → low)",
  job_id_asc: "Job ID (low → high)",
};

function jobNumberValue(jobId: string): number {
  const n = parseInt(jobId.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function compareIso(a: string | undefined, b: string | undefined): number {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return ta - tb;
}

/** Sort by Spring Boot `createdDate`; falls back to job number if timestamp missing. */
function compareCreated(a: Job, b: Job, newestFirst: boolean): number {
  const primary = newestFirst
    ? compareIso(b.createdAt, a.createdAt)
    : compareIso(a.createdAt, b.createdAt);
  if (primary !== 0) return primary;
  return newestFirst
    ? jobNumberValue(b.id) - jobNumberValue(a.id)
    : jobNumberValue(a.id) - jobNumberValue(b.id);
}

export function sortJobs(jobs: Job[], sortBy: JobSortOption): Job[] {
  const copy = [...jobs];
  copy.sort((a, b) => {
    switch (sortBy) {
      case "created_desc":
        return compareCreated(a, b, true);
      case "created_asc":
        return compareCreated(a, b, false);
      case "due_asc":
        return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
      case "due_desc":
        return (b.dueDate ?? "").localeCompare(a.dueDate ?? "");
      case "job_id_desc":
        return jobNumberValue(b.id) - jobNumberValue(a.id);
      case "job_id_asc":
        return jobNumberValue(a.id) - jobNumberValue(b.id);
      default:
        return 0;
    }
  });
  return copy;
}

export function paginateJobs<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(itemCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}
