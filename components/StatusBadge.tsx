import { resolveStatusGroup, statusDescription } from "@/lib/jobStatus";
import type { JobStageGroup } from "@/lib/jobStageGroups";
import type { JobStatus } from "@/lib/types";

/**
 * Badge styling follows the stage group rather than the individual status, so
 * the palette holds as the lifecycle grows. Preserves the MVP colour language:
 * red = pre-production, amber = on the floor, emerald = delivered.
 */
const groupStyles: Record<JobStageGroup, string> = {
  "not-started": "border-red-200 bg-red-50 text-red-700",
  manufacturing: "border-amber-200 bg-amber-50 text-amber-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

/** Cancelled is terminal, not merely pre-production — darkened to read apart. */
const CANCELLED_STYLE = "border-red-200 bg-red-50 text-red-900";

export function StatusBadge({ status }: { status: JobStatus }) {
  const className =
    status === "Cancelled" ? CANCELLED_STYLE : groupStyles[resolveStatusGroup(status)];

  return (
    <span
      title={statusDescription(status) || undefined}
      className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm font-semibold leading-none sm:text-base ${className}`}
    >
      {status}
    </span>
  );
}
