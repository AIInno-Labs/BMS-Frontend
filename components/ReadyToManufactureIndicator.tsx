import { isReadyToManufacture } from "@/lib/mockData";
import type { Job } from "@/lib/types";

export function ReadyToManufactureIndicator({ job }: { job: Job }) {
  const ready = isReadyToManufacture(job);

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
          ready ? "bg-amber-500" : "bg-red-300"
        }`}
        aria-hidden
      />
      <span
        className={`text-base font-semibold ${
          ready ? "text-amber-700" : "text-red-700"
        }`}
      >
        {ready ? "Yes" : "No"}
      </span>
    </div>
  );
}
