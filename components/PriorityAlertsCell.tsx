import { AlertTriangle } from "lucide-react";
import type { Job } from "@/lib/types";

const priorityStyles: Record<
  Job["priority"],
  { badge: string; label: string } | null
> = {
  RUSH: {
    badge: "border border-red-200 bg-red-100 text-red-700",
    label: "RUSH",
  },
  High: {
    badge: "border border-amber-200 bg-amber-100 text-amber-800",
    label: "HIGH",
  },
  Normal: null,
};

export function PriorityBadge({ priority }: { priority: Job["priority"] }) {
  const style = priorityStyles[priority];
  if (!style) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-bold leading-none tracking-wide sm:text-base ${style.badge}`}
    >
      {style.label}
    </span>
  );
}

export function PriorityAlertsCell({
  job,
  layout = "stack",
  showAlert = true,
}: {
  job: Job;
  layout?: "stack" | "inline";
  /** When false, only priority badge is shown (alert shown elsewhere). */
  showAlert?: boolean;
}) {
  if (layout === "inline") {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 sm:inline-flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <PriorityBadge priority={job.priority} />
        {showAlert && job.alert ? (
          <span
            className="inline-flex w-full max-w-full items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900 sm:w-auto"
            title={job.alert}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{job.alert}</span>
          </span>
        ) : showAlert && !job.alert ? (
          <span className="text-sm leading-none text-slate-500">No alerts</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <PriorityBadge priority={job.priority} />
      {job.alert ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            aria-hidden
          />
          <p className="text-base font-semibold text-amber-900">{job.alert}</p>
        </div>
      ) : (
        <p className="text-base text-slate-500">No alerts</p>
      )}
    </div>
  );
}
