import { timelineStageInfo } from "@/lib/jobTimelineAnalytics";
import { resolveStatusGroup } from "@/lib/jobStatus";
import { isCancelledJob } from "@/lib/frp/job-status";
import type { Job } from "@/lib/types";

const GROUP_LABEL: Record<string, string> = {
  "not-started": "Not Started",
  manufacturing: "Manufacturing",
  delivered: "Delivered",
};

/** Fixed left-to-right pipeline order for charts — draft through completed,
 *  the coarse fallback labels, then Cancelled last. */
export const JOB_STAGE_LABEL_ORDER = [
  "Draft",
  "Drawing",
  "Approval",
  "Production",
  "QC",
  "Dispatch",
  "Completed",
  "Not Started",
  "Manufacturing",
  "Delivered",
  "Cancelled",
] as const;

/**
 * Mirrors `getStageBadgeLabel()` in JobsList.tsx (private to that file) so
 * this shows the exact same per-job stage a user would see as the badge on
 * the real Jobs page: `currentStageKey`'s real milestone name (Draft /
 * Drawing / Approval / Production / QC / Dispatch / Completed) when the
 * backend has populated it, falling back to the coarse status group when it
 * hasn't.
 *
 * Unlike the Jobs page — which shows "Cancelled" as a second badge alongside
 * the stage badge — this returns one mutually-exclusive label per job (a
 * pie slice can't belong to two categories), so a cancelled job is counted
 * under "Cancelled" only, taking priority over whatever stage it reached.
 */
export function jobStageLabel(job: Job): string {
  if (isCancelledJob(job.status)) return "Cancelled";
  const real = timelineStageInfo(job.currentStageKey);
  if (real) return real.title;
  return GROUP_LABEL[resolveStatusGroup(job.status)] ?? "Not Started";
}
