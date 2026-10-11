import type { JobStatus } from "@/lib/types";

const statusStyles: Record<JobStatus, string> = {
  Pending: "border-red-200 bg-red-50 text-red-700",
  "Awaiting Manager Approval": "border-red-200 bg-red-50 text-red-700",
  "Ready to Manufacture": "border-amber-200 bg-amber-50 text-amber-700",
  "In Fabrication": "border-amber-200 bg-amber-50 text-amber-700",
  "On Hold": "border-red-200 bg-red-50 text-red-700",
  Complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Cancelled: "border-red-200 bg-red-50 text-red-900",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-3 py-1 text-sm font-semibold leading-none sm:text-base ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
