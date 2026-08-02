"use client";

import { History } from "lucide-react";
import { ensureWorkflowExtras } from "@/lib/jobWorkflowExtras";
import type { Job, JobCardPrintDetails } from "@/lib/types";

interface JobProgramHistoryCardProps {
  job: Job;
  pd: JobCardPrintDetails;
  onPrint: () => void;
  className?: string;
}

export function JobProgramHistoryCard({
  job,
  pd,
  onPrint,
  className = "",
}: JobProgramHistoryCardProps) {
  const extras = ensureWorkflowExtras(pd.workflowExtras, job);
  const lines = extras.programHistory ?? [];

  return (
    <section
      className={`app-card flex h-full w-full flex-col p-3 sm:p-4 ${className}`}
      aria-label="Latest program identity history"
    >
      <div className="shrink-0 space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <History className="h-4 w-4 shrink-0 text-[#F97316]" />
          <span className="leading-tight">Latest program identity history</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#111827] shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50"
            onClick={onPrint}
          >
            View job card (PDF)
          </button>
        </div>
      </div>
      <ul className="mt-2.5 min-h-0 flex-1 space-y-1 overflow-y-auto text-xs text-slate-700 sm:text-sm">
        {lines.map((line) => (
          <li
            key={line}
            className="rounded-md border border-[#E5E7EB] bg-[#FAFBFC] px-2.5 py-1.5 leading-snug"
          >
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
