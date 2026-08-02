"use client";

import Link from "next/link";
import { CalendarDays, Sparkles } from "lucide-react";
import { useJobs } from "@/context/JobsContext";
import { floorHealthSummary, floorWorkers } from "@/lib/laborMock";
import type { Job } from "@/lib/types";

interface FactoryCommandPanelProps {
  onOpenWhiteboard: () => void;
  onOpenRebalance: () => void;
  /** Tighter layout when embedded beside dashboard charts */
  compact?: boolean;
  /** Hide footer action buttons when actions are rendered elsewhere. */
  showActions?: boolean;
}

function getTopPriorityJobs(allJobs: Job[]): Job[] {
  return [...allJobs]
    .filter(
      (j) =>
        j.priority === "RUSH" ||
        j.status === "In Fabrication" ||
        j.alert != null
    )
    .sort((a, b) => {
      if (a.priority === "RUSH" && b.priority !== "RUSH") return -1;
      if (b.priority === "RUSH" && a.priority !== "RUSH") return 1;
      if (a.status === "In Fabrication" && b.status !== "In Fabrication")
        return -1;
      if (b.status === "In Fabrication" && a.status !== "In Fabrication")
        return 1;
      return 0;
    })
    .slice(0, 2);
}

export function FactoryCommandPanel({
  onOpenWhiteboard,
  onOpenRebalance,
  compact = false,
  showActions = true,
}: FactoryCommandPanelProps) {
  const { jobs } = useJobs();
  const priorityJobs = getTopPriorityJobs(jobs);
  const onFloor = floorWorkers.filter((w) => !w.absent).length;
  const overtime = floorWorkers.find((w) => w.hoursUsed > w.hoursCapacity);

  return (
    <section
      className={`flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm max-lg:min-h-[min(22rem,50vh)] lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)_auto] ${
        compact ? "lg:max-h-full" : ""
      }`}
    >
      <header className="shrink-0 border-b border-slate-100 px-3 pb-2 pt-3 lg:px-4 lg:pt-4">
        <p className="text-sm font-semibold text-slate-900 sm:text-base">
          Alerts &amp; next actions for today&apos;s shift
        </p>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 max-lg:max-h-72 lg:px-4">
        <div className="space-y-2">
          <div className="break-words rounded-lg bg-red-50 px-3 py-2 text-sm font-medium leading-snug text-red-700 sm:text-base">
            ⚠️ Mike T. absent - use AI Rebalance to reassign his queue.
          </div>

          <p className="break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-snug text-slate-700 sm:text-base">
            <span className="font-semibold text-slate-900">{onFloor} on floor</span>
            {" · "}
            <span className="font-semibold text-red-700">1 absent</span>
            {" · "}
            <span className="font-semibold text-slate-900">
              {floorHealthSummary.capacityUtilization}% capacity
            </span>
          </p>

          {overtime && (
            <p className="break-words rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900 sm:text-base">
              <span className="font-semibold">{overtime.name}</span> at{" "}
              {overtime.hoursUsed}/{overtime.hoursCapacity}h (OT risk). Bay done
              ~<span className="font-semibold">4:30 PM</span>.
            </p>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-900 sm:text-base">
              Needs attention now
            </p>
            <ul className="space-y-1.5">
              {priorityJobs.map((job) => (
                <li key={job.id} className="min-w-0">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="block min-w-0 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 font-semibold text-slate-900">
                        {job.id}
                      </span>
                      {job.priority === "RUSH" && (
                        <span className="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 sm:text-sm">
                          RUSH
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 sm:text-base">
                      {job.clientName} - {job.status}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {!compact && (
              <button
                type="button"
                onClick={onOpenWhiteboard}
                className="mt-1.5 text-base font-medium text-blue-600 hover:text-blue-800"
              >
                View full schedule in whiteboard →
              </button>
            )}
          </div>
        </div>
      </div>

      {showActions && (
        <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] lg:px-4">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onOpenWhiteboard}
              className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200 sm:w-auto sm:flex-1 sm:text-base"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Scheduling Whiteboard</span>
            </button>
            <button
              type="button"
              onClick={onOpenRebalance}
              className="inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 sm:w-auto sm:flex-1 sm:text-base"
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">AI Rebalance Floor</span>
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
