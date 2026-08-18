"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Plus,
  Workflow,
  X,
} from "lucide-react";
import { CreateNewJobDrawer } from "@/components/CreateNewJobDrawer";
import { JobsPagination } from "@/components/JobsPagination";
import { PriorityAlertsCell } from "@/components/PriorityAlertsCell";
import { ReadyToManufactureIndicator } from "@/components/ReadyToManufactureIndicator";
import { parseNaturalLanguageQuery } from "@/lib/aiMock";
import {
  formatCreatedDate,
  formatDate,
  formatShortDate,
  formatEstimatedHours,
  hasSchedulingBlockAlert,
} from "@/lib/mockData";
import {
  JOBS_PAGE_SIZE,
  paginateJobs,
  sortJobs,
  totalPages,
  type JobSortOption,
} from "@/lib/jobListUtils";
import { usePersona } from "@/context/PersonaContext";
import { useJobs } from "@/context/JobsContext";
import { useAuth } from "@/context/AuthContext";
import { ACCESS_KEYS } from "@/lib/frp/access";
import { stageGroupCounts } from "@/lib/frp/job-counts";
import {
  filterJobsByStageGroup,
  jobMatchesStageGroup,
  STAGE_GROUP_INFO,
  type JobStageGroup,
  parseStageGroupParam,
} from "@/lib/jobStageGroups";
import { isCancelledJob } from "@/lib/frp/job-status";
import { resolveStatusGroup } from "@/lib/jobStatus";
import { timelineStageInfo } from "@/lib/jobTimelineAnalytics";
import type { Job, JobStatus, ResinType } from "@/lib/types";

interface JobsListProps {
  jobs: Job[];
}

function getJobRowClass(job: Job, striped: "white" | "slate"): string {
  if (hasSchedulingBlockAlert(job)) {
    return "border-l-4 border-l-orange-300 bg-orange-50";
  }
  return striped === "white" ? "bg-white" : "bg-[#FAFBFC]";
}

const STAGE_GROUP_CLASS: Record<JobStageGroup, string> = {
  "not-started": "status-pill status-pill--not-started",
  manufacturing: "status-pill status-pill--manufacturing",
  delivered: "status-pill status-pill--delivered",
};

function stageGroupFromKey(stageKey?: string | null): JobStageGroup | null {
  if (stageKey === "draft" || stageKey === "design" || stageKey === "approval") {
    return "not-started";
  }
  if (stageKey === "production" || stageKey === "qc") return "manufacturing";
  if (stageKey === "dispatch" || stageKey === "completed") return "delivered";
  return null;
}

function getStageBadgeClass(job: Job): string {
  if (isCancelledJob(job.status)) {
    const fromKey = stageGroupFromKey(job.currentStageKey);
    if (fromKey) return STAGE_GROUP_CLASS[fromKey];
  }
  return STAGE_GROUP_CLASS[resolveStatusGroup(job.status)];
}

const STAGE_GROUP_LABEL_FULL: Record<JobStageGroup, string> = {
  "not-started": "Not Started",
  manufacturing: "Manufacturing",
  delivered: "Delivered",
};

const STAGE_GROUP_LABEL_SHORT: Record<JobStageGroup, string> = {
  "not-started": "New",
  manufacturing: "Mfg",
  delivered: "Del",
};

// currentStageKey (backend-computed: furthest milestone that's complete or
// active) names the real stage, e.g. "Drawing" — more precise than the
// coarse status group, which only advances once the *next* stage has
// started. Falls back to the group label for jobs the backend hasn't
// populated it on.
function getStageBadgeLabel(job: Job, variant: "full" | "short"): string {
  const real = timelineStageInfo(job.currentStageKey);
  if (real) return variant === "full" ? real.title : real.shortLabel;
  const group = resolveStatusGroup(job.status);
  return variant === "full" ? STAGE_GROUP_LABEL_FULL[group] : STAGE_GROUP_LABEL_SHORT[group];
}

const STAGE_BADGE_CLASS =
  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

/** Stage from currentStageKey, plus Cancelled when stageStatus is CANCELLED. */
function JobListStageBadges({
  job,
  variant,
}: {
  job: Job;
  variant: "full" | "short";
}) {
  const cancelled = isCancelledJob(job.status);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`${STAGE_BADGE_CLASS} ${getStageBadgeClass(job)}`}>
        {getStageBadgeLabel(job, variant)}
      </span>
      {cancelled ? (
        <span className={`${STAGE_BADGE_CLASS} status-pill status-pill--cancelled`}>
          Cancelled
        </span>
      ) : null}
    </span>
  );
}

export function JobsList({ jobs }: JobsListProps) {
  const { counts } = useJobs();
  const { isWorker } = usePersona();
  const { can } = useAuth();
  const canCreateJob = can(ACCESS_KEYS.JOBS_CREATE);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">("All");
  const [stageGroupFilter, setStageGroupFilter] = useState<JobStageGroup | null>(
    () => parseStageGroupParam(searchParams.get("group"))
  );
  const [resinFilter] = useState<ResinType | "All">("All");
  const [sortBy, setSortBy] = useState<JobSortOption>("created_desc");
  const [page, setPage] = useState(1);
  const [createJobOpen, setCreateJobOpen] = useState(false);

  useEffect(() => {
    const fromUrl = parseStageGroupParam(searchParams.get("group"));
    setStageGroupFilter(fromUrl);
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const filteredJobs = useMemo(() => {
    const parsed = parseNaturalLanguageQuery(searchQuery);
    const textQuery = parsed.searchText.toLowerCase();

    return jobs.filter((job) => {
      const matchesResin =
        resinFilter === "All" || job.resinType === resinFilter;
      const matchesStageGroup =
        !stageGroupFilter || jobMatchesStageGroup(job, stageGroupFilter);
      const matchesStage = statusFilter === "All" || job.status === statusFilter;
      const matchesStatus =
        !parsed.statusFilter || job.status === parsed.statusFilter;
      const matchesPriority =
        !parsed.priorityFilter || job.priority === parsed.priorityFilter;
      const matchesClientHint =
        !parsed.clientHint ||
        job.clientName.toLowerCase().includes(parsed.clientHint);
      const contactName = (job.clientContactName ?? "").toLowerCase();
      const matchesSearch =
        !textQuery ||
        job.clientName.toLowerCase().includes(textQuery) ||
        job.projectName.toLowerCase().includes(textQuery) ||
        job.id.toLowerCase().includes(textQuery) ||
        contactName.includes(textQuery);
      return (
        matchesResin &&
        matchesStageGroup &&
        matchesStage &&
        matchesStatus &&
        matchesPriority &&
        matchesClientHint &&
        matchesSearch
      );
    });
  }, [jobs, searchQuery, resinFilter, statusFilter, stageGroupFilter]);

  const stageGroupJobs = useMemo(
    () =>
      stageGroupFilter ? filterJobsByStageGroup(jobs, stageGroupFilter) : [],
    [jobs, stageGroupFilter]
  );

  const handleStageCardClick = (group: JobStageGroup) => {
    const next = stageGroupFilter === group ? null : group;
    setStageGroupFilter(next);
    if (next) {
      setStatusFilter("All");
      const params = new URLSearchParams(searchParams.toString());
      params.set("group", next);
      router.replace(`/jobs?${params.toString()}`, { scroll: false });
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("group");
      const qs = params.toString();
      router.replace(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
    }
  };

  const stageCards = useMemo(() => {
    // Org-wide, from GET /jobs/counts via JobsContext — these cards summarise
    // the whole tenant, not the page the table below happens to show.
    const { delivered, manufacturing, notStarted, total } =
      stageGroupCounts(counts);

    return [
      {
        key: "not-started" as const,
        label: "Not Started",
        value: notStarted,
        pct: Math.round((notStarted / total) * 100),
        icon: Clock3,
        accent: "#EF4444",
        tint: "from-red-50 to-white",
        line: [12, 11, 10, 9, 9, 8],
      },
      {
        key: "manufacturing" as const,
        label: "Manufacturing",
        value: manufacturing,
        pct: Math.round((manufacturing / total) * 100),
        icon: Workflow,
        accent: "#F59E0B",
        tint: "from-amber-50 to-white",
        line: [6, 7, 6, 8, 9, 10],
      },
      {
        key: "delivered" as const,
        label: "Delivered",
        value: delivered,
        pct: Math.round((delivered / total) * 100),
        icon: CheckCircle2,
        accent: "#10B981",
        tint: "from-emerald-50 to-white",
        line: [4, 6, 8, 10, 12, 14],
      },
    ];
  }, [counts]);

  const sortedJobs = useMemo(
    () => sortJobs(filteredJobs, sortBy),
    [filteredJobs, sortBy]
  );

  const pages = totalPages(sortedJobs.length, JOBS_PAGE_SIZE);
  const safePage = Math.min(page, pages);

  const pagedJobs = useMemo(
    () => paginateJobs(sortedJobs, safePage, JOBS_PAGE_SIZE),
    [sortedJobs, safePage]
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, resinFilter, statusFilter, stageGroupFilter, sortBy, jobs.length]);

  const clearStageGroupFilter = () => {
    setStageGroupFilter(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("group");
    const qs = params.toString();
    router.replace(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
  };

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  return (
    <div className={`space-y-4 ${isWorker ? "worker-ui" : ""}`}>
      <p className="text-sm text-slate-500">Fabrication programs and stage tracking</p>

      <CreateNewJobDrawer
        open={createJobOpen && canCreateJob}
        onClose={() => setCreateJobOpen(false)}
        jobs={jobs}
      />

      {!isWorker && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3" aria-label="Jobs by stage">
          {stageCards.map((card) => {
            const active = stageGroupFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => handleStageCardClick(card.key)}
                aria-pressed={active}
                className={`w-full rounded-2xl border bg-linear-to-r ${card.tint} p-4 text-left shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.09)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${
                  active
                    ? "border-orange-300 ring-2 ring-orange-200"
                    : "border-[#E5E7EB]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {card.label}
                    </p>
                    <p className="mt-1 text-3xl font-semibold leading-none text-[#111827]">
                      {card.value}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {card.pct}% of jobs
                    </p>
                  </div>
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${card.accent}20`, color: card.accent }}
                  >
                    <card.icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <Sparkline points={card.line} color={card.accent} />
                <p className="mt-2 text-[11px] font-medium text-slate-500">
                  {active ? "Showing details below · click again to clear" : "Click to view jobs in this stage"}
                </p>
              </button>
            );
          })}
        </section>
      )}

      {!isWorker && stageGroupFilter && (
        <section
          className="rounded-2xl border border-orange-200/80 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
          aria-live="polite"
        >
          {(() => {
            const info = STAGE_GROUP_INFO[stageGroupFilter];
            const preview = stageGroupJobs.slice(0, 8);
            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-600">
                      {info.label}
                    </p>
                    <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                      {info.headline}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">{info.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Includes:{" "}
                      <span className="font-medium text-slate-700">
                        {info.statuses.join(" · ")}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearStageGroupFilter}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Clear filter
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {stageGroupJobs.length} job{stageGroupJobs.length === 1 ? "" : "s"} in this stage
                </p>
                {preview.length > 0 ? (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {preview.map((job) => (
                      <li key={job.id}>
                        <Link
                          href={`/jobs/${job.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-orange-50/50"
                        >
                          <span className="font-semibold text-slate-900">{job.id}</span>
                          <span className="min-w-0 truncate text-slate-600">{job.clientName}</span>
                          <JobListStageBadges job={job} variant="short" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No jobs in this stage right now.</p>
                )}
                {stageGroupJobs.length > preview.length && (
                  <p className="mt-2 text-xs text-slate-500">
                    Showing {preview.length} of {stageGroupJobs.length} — full list in the table
                    below.
                  </p>
                )}
              </>
            );
          })()}
        </section>
      )}

      {!isWorker && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="inline-flex h-[46px] min-w-0 items-center justify-between rounded-full border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#111827] focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
            <span className="shrink-0">ALL STAGES</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as JobStatus | "All");
                if (stageGroupFilter) clearStageGroupFilter();
              }}
              className="ml-2 min-w-0 max-w-36 truncate bg-transparent text-[11px] outline-none hover:text-[#EA580C]"
              aria-label="Filter stage"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Awaiting Manager Approval">Approval</option>
              <option value="Ready to Manufacture">Ready</option>
              <option value="In Fabrication">Manufacturing</option>
              <option value="Complete">Delivered</option>
            </select>
          </label>
          {canCreateJob && (
            <button
              type="button"
              onClick={() => setCreateJobOpen(true)}
              className="inline-flex h-[46px] items-center justify-center gap-1.5 rounded-full bg-[#F97316] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#EA580C]"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
              NEW JOB
            </button>
          )}
        </div>
      )}

      {isWorker && sortedJobs.length > 0 && (
        <label className="block sm:max-w-xs">
          <span className="mb-2 block text-base font-semibold text-slate-900">
            Sort by
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as JobSortOption)}
            className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900"
          >
            <option value="created_desc">Created date (newest first)</option>
            <option value="created_asc">Created date (oldest first)</option>
            <option value="due_asc">Due date (soonest)</option>
            <option value="job_id_desc">Job ID (high → low)</option>
          </select>
        </label>
      )}

      {sortedJobs.length === 0 ? (
        <p className="app-card text-center text-base font-medium text-slate-600">
          {isWorker
            ? "No assigned jobs on the floor right now. Check back later."
            : stageGroupFilter
              ? `No jobs in ${STAGE_GROUP_INFO[stageGroupFilter].label} match your search. Clear filters or try another stage.`
              : "No jobs match your filters. Try clearing search or selecting another stage."}
        </p>
      ) : (
        <>
          <JobsTable jobs={pagedJobs} workerMode={isWorker} />
          <JobsCards jobs={pagedJobs} workerMode={isWorker} />
          <JobsPagination
            page={safePage}
            totalPages={pages}
            pageSize={JOBS_PAGE_SIZE}
            totalItems={sortedJobs.length}
            onPageChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />

        </>
      )}
    </div>
  );
}

const TH =
  "whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 align-middle";
const TD = "px-3 py-3.5 align-middle text-xs text-slate-700";

function JobsTable({
  jobs,
  workerMode = false,
}: {
  jobs: Job[];
  workerMode?: boolean;
}) {
  const router = useRouter();

  const openJobPage = (jobId: string) => {
    router.push(`/jobs/${encodeURIComponent(jobId)}`);
  };
  return (
    <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)] lg:block">
      <div className="max-h-[min(28rem,65vh)] overflow-auto">
      <table
        className={`w-full table-fixed border-collapse ${workerMode ? "min-w-lg" : "min-w-[940px]"}`}
      >
        {workerMode ? (
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[48%]" />
            <col className="w-[30%]" />
          </colgroup>
        ) : (
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[28%]" />
            <col className="w-[17%]" />
            <col className="w-[18%]" />
            <col className="w-[19%]" />
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
            <th className={`sticky top-0 z-10 bg-[#F8FAFC] ${TH} text-left`}>JOB #</th>
            <th className={`sticky top-0 z-10 bg-[#F8FAFC] ${TH} text-left`}>CUSTOMER</th>
            {!workerMode && <th className={`sticky top-0 z-10 bg-[#F8FAFC] ${TH} text-left`}>CONTACT</th>}
            {!workerMode && <th className={`sticky top-0 z-10 bg-[#F8FAFC] ${TH} text-left`}>DUE DATE</th>}
            {!workerMode && <th className={`sticky top-0 z-10 bg-[#F8FAFC] ${TH} text-left`}>STAGE</th>}
            {workerMode && <th className={`sticky top-0 z-10 bg-[#F8FAFC] ${TH} text-left`}>DUE DATE</th>}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, index) => (
                <tr
                  key={job.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openJobPage(job.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openJobPage(job.id);
                    }
                  }}
                  className={`cursor-pointer border-b border-[#E5E7EB] transition-colors duration-200 ease-in-out hover:bg-orange-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60 focus-visible:ring-inset ${getJobRowClass(job, index % 2 === 0 ? "white" : "slate")}`}
                >
                  <td className={`${TD} text-left`}>
                    <span className="text-xs font-semibold text-slate-900">{job.id}</span>
                  </td>
                  <td className={`${TD} text-left`}>
                    <p className="truncate font-medium text-slate-900">{job.clientName}</p>
                    <p className="truncate text-[10px] text-slate-500">{job.projectName}</p>
                  </td>
                  {!workerMode && (
                    <td className={`${TD} text-left`}>
                      <p className="truncate text-xs text-slate-700">{job.clientContactName}</p>
                    </td>
                  )}
                  {!workerMode && <td className={`${TD} text-left tabular-nums`}>{formatShortDate(job.dueDate)}</td>}
                  {!workerMode && (
                    <td className={`${TD} text-left`}>
                      <JobListStageBadges job={job} variant="full" />
                    </td>
                  )}
                  {workerMode && <td className={`${TD} text-left tabular-nums`}>{formatShortDate(job.dueDate)}</td>}
                </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function JobsCards({
  jobs,
  workerMode = false,
}: {
  jobs: Job[];
  workerMode?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col lg:hidden ${workerMode ? "gap-4" : "gap-3"}`}
    >
      {jobs.map((job) => (
        <article
          key={job.id}
          className={`rounded-[14px] border border-[#E2E8F0] bg-white shadow-sm ${workerMode ? "p-6" : "p-4"} ${
            hasSchedulingBlockAlert(job)
              ? "border-[#93C5FD] bg-[#EFF6FF]"
              : ""
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">{job.id}</p>
              <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-slate-900">
                {job.clientName}
              </p>
            </div>
            {!workerMode && (
              <span className="shrink-0">
                <JobListStageBadges job={job} variant="short" />
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{job.projectName}</p>
          {(job.priority !== "Normal" || job.alert) && (
            <div className="mt-4">
              <PriorityAlertsCell job={job} />
            </div>
          )}
          <dl
            className={`mt-5 gap-4 border-t border-slate-200 pt-5 ${workerMode ? "space-y-3" : "grid grid-cols-2"}`}
          >
            <div>
              <dt className="text-base font-medium text-slate-600">
                Date Received
              </dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">
                {formatDate(job.date)}
              </dd>
            </div>
            {!workerMode && (
              <div>
                <dt className="text-base font-medium text-slate-600">
                  Date Created
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">
                  {formatCreatedDate(job.createdAt)}
                </dd>
              </div>
            )}
            {!workerMode && (
              <div>
                <dt className="text-base font-medium text-slate-600">
                  Est. Hours
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">
                  {job.estimatedHours == null ? (
                    <span className="text-[#2563EB]">Not set</span>
                  ) : (
                    formatEstimatedHours(job.estimatedHours)
                  )}
                </dd>
              </div>
            )}
          </dl>
          {!workerMode && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="mb-2 text-base font-medium text-slate-600">
                Ready to Manufacture
              </p>
              <ReadyToManufactureIndicator job={job} />
            </div>
          )}
          <div className={workerMode ? "mt-6" : "mt-4"}>
            <ViewDetailsLink jobId={job.id} fullWidth workerMode={workerMode} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ViewDetailsLink({
  jobId,
  fullWidth = false,
  workerMode = false,
  className = "",
}: {
  jobId: string;
  fullWidth?: boolean;
  workerMode?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/jobs/${encodeURIComponent(jobId)}`}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-all duration-150 ease-in-out ${
        workerMode
          ? "min-h-[56px] w-full bg-[#2563EB] px-6 py-4 text-lg text-white shadow-sm hover:bg-[#1D4ED8] sm:min-h-[64px] sm:text-xl"
          : `min-h-[40px] border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] shadow-sm hover:border-[#BFDBFE] hover:bg-[#EFF6FF] ${fullWidth ? "w-full" : ""}`
      } ${className}`}
    >
      Open
      <ArrowRight className={workerMode ? "h-7 w-7" : "h-3.5 w-3.5"} aria-hidden />
    </Link>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const width = 140;
  const height = 36;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(1, max - min);
  const polyline = points
    .map((value, idx) => {
      const x = (idx / Math.max(points.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,${height} ${polyline} ${width},${height}`;

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" aria-hidden>
        <polygon points={area} fill={color} fillOpacity={0.1} />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
