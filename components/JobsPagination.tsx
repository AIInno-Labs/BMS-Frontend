"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface JobsPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function JobsPagination({
  page,
  totalPages: pages,
  pageSize,
  totalItems,
  onPageChange,
}: JobsPaginationProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <nav
      className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Jobs list pagination"
    >
      <p className="text-sm text-slate-600">
        Showing{" "}
        <span className="font-semibold text-slate-900">
          {start}–{end}
        </span>{" "}
        of <span className="font-semibold text-slate-900">{totalItems}</span> jobs
        <span className="hidden sm:inline">
          {" "}
          · Page {page} of {pages}
        </span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
