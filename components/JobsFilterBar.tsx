"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info, Mic, Search, Sparkles, X } from "lucide-react";
import {
  describeParsedQuery,
  parseNaturalLanguageQuery,
} from "@/lib/aiMock";
import { resinTypes } from "@/lib/mockData";
import { JOB_SORT_LABELS, type JobSortOption } from "@/lib/jobListUtils";
import { jobStatuses } from "@/lib/mockData";
import type { JobStatus, ResinType } from "@/lib/types";

interface JobsFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: JobStatus | "All";
  onStatusChange: (value: JobStatus | "All") => void;
  resinFilter: ResinType | "All";
  onResinChange: (value: ResinType | "All") => void;
  sortBy: JobSortOption;
  onSortChange: (value: JobSortOption) => void;
  matchCount: number;
  totalCount: number;
  mode?: "inline" | "popup";
}

const fieldLabel =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500";

const fieldControl =
  "w-full min-h-[48px] rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

export function JobsFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  resinFilter,
  onResinChange,
  sortBy,
  onSortChange,
  matchCount,
  totalCount,
  mode = "inline",
}: JobsFilterBarProps) {
  const [isListening, setIsListening] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const parsed = useMemo(
    () => parseNaturalLanguageQuery(searchQuery),
    [searchQuery]
  );
  const aiSummary = describeParsedQuery(parsed);

  const hasActiveFilters =
    resinFilter !== "All" || statusFilter !== "All" || searchQuery.trim().length > 0;

  const handleMicClick = () => {
    setIsListening(true);
    onSearchChange("Show me all pending jobs for Water Corp");
    window.setTimeout(() => setIsListening(false), 1800);
  };

  const clearAll = () => {
    onSearchChange("");
    onStatusChange("All");
    onResinChange("All");
  };

  const isPopup = mode === "popup";

  return (
    <section className="min-w-0" aria-label="Search and filter fabrication jobs">
      {!isPopup && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Search &amp; filters
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">
              {matchCount === totalCount
                ? `${totalCount} jobs in queue`
                : `${matchCount} of ${totalCount} jobs shown`}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <X className="h-4 w-4" aria-hidden />
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className={`space-y-3 ${isPopup ? "p-1" : "p-4 sm:p-5"}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Search &amp; filters
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {matchCount === totalCount
              ? `${totalCount} jobs in queue`
              : `${matchCount} of ${totalCount} jobs shown`}
          </p>
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="jobs-search" className={fieldLabel}>
              Search jobs
              <span className="ml-1.5 normal-case tracking-normal text-violet-600">
                · Smart
              </span>
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                id="jobs-search"
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Job ID, client, project, or natural language…"
                className={`${fieldControl} pl-10 pr-12 ${
                  isListening ? "border-violet-400 ring-2 ring-violet-400/20" : ""
                }`}
              />
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isListening}
                className={`absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border transition-colors ${
                  isListening
                    ? "border-violet-300 bg-violet-100 text-violet-700"
                    : "border-slate-200 bg-slate-50 text-violet-600 hover:bg-violet-50"
                }`}
                aria-label="Voice search demo"
                title="Voice search (demo)"
              >
                <Mic
                  className={`h-4 w-4 ${isListening ? "animate-pulse" : ""}`}
                  aria-hidden
                />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="jobs-stage" className={fieldLabel}>
              Stage
            </label>
            <select
              id="jobs-stage"
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as JobStatus | "All")}
              className={fieldControl}
            >
              <option value="All">All stages</option>
              {jobStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="jobs-resin" className={fieldLabel}>
              Resin type
            </label>
            <select
              id="jobs-resin"
              value={resinFilter}
              onChange={(e) => onResinChange(e.target.value as ResinType | "All")}
              className={fieldControl}
            >
              <option value="All">All resin types</option>
              {resinTypes.map((resin) => (
                <option key={resin} value={resin}>
                  {resin}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="jobs-sort" className={fieldLabel}>
              Sort by
            </label>
            <select
              id="jobs-sort"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as JobSortOption)}
              className={fieldControl}
            >
              {(Object.keys(JOB_SORT_LABELS) as JobSortOption[]).map((key) => (
                <option key={key} value={key}>
                  {JOB_SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="pb-0.5">
            <button
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              More Filters
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showMoreFilters ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${
            showMoreFilters ? "max-h-32" : "max-h-0"
          }`}
        >
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <p className="text-sm text-slate-600">
              Smart parser supports commands like <span className="font-semibold">RUSH</span>,
              <span className="font-semibold"> pending</span>, and customer names.
            </p>
            <p className="text-sm text-slate-600">
              Use Stage + Resin together for a compact workflow-focused queue.
            </p>
          </div>
        </div>

        {isListening && (
          <p
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800"
            role="status"
          >
            Listening… applying: pending jobs for Water Corp
          </p>
        )}

        {!isListening && aiSummary && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5"
            role="status"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-violet-900">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              {aiSummary}
            </p>
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="text-sm font-semibold text-violet-700 hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {resinFilter !== "All" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
                Resin: {resinFilter}
                <button
                  type="button"
                  onClick={() => onResinChange("All")}
                  className="rounded-full p-0.5 hover:bg-blue-100"
                  aria-label="Remove resin filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {statusFilter !== "All" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800">
                Stage: {statusFilter}
                <button
                  type="button"
                  onClick={() => onStatusChange("All")}
                  className="rounded-full p-0.5 hover:bg-violet-100"
                  aria-label="Remove stage filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {searchQuery.trim() && !aiSummary && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Search: &ldquo;{searchQuery.slice(0, 32)}
                {searchQuery.length > 32 ? "…" : ""}&rdquo;
              </span>
            )}
          </div>
        )}
        {(isPopup || hasActiveFilters) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {!isPopup && (
        <div className="flex items-start gap-2.5 border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-600">
            Prioritize <span className="font-semibold text-slate-800">RUSH</span> jobs
            and rows with material alerts. Sort by created date to see the newest
            programs first.
          </p>
        </div>
      )}
    </section>
  );
}
