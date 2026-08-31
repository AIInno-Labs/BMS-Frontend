"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MIN_JOB_SEARCH_LENGTH,
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
  STAGE_GROUP_INFO,
  type JobStageGroup,
  parseStageGroupParam,
} from "@/lib/jobStageGroups";
import {
  BACKEND_JOB_STATUSES,
  isCancelledJob,
  priorityToBackend,
  statusToBackend,
  statusToUi,
  type BackendJobStatus,
} from "@/lib/frp/job-status";
import { resolveStatusGroup } from "@/lib/jobStatus";
import { timelineStageInfo } from "@/lib/jobTimelineAnalytics";
import { listJobs, type FrpJobSort } from "@/lib/frp/api";
import { frpJobSummaryToUi, userIdToBackend } from "@/lib/frp/job-mapper";
import {
  duePresetToDueBefore,
  parseAssignedToParam,
  parseDuePresetParam,
  shouldKeepJobForDuePreset,
  type JobListDuePreset,
} from "@/lib/jobListUrlFilters";
import type { Job, JobStatus, ResinType } from "@/lib/types";

/** Local calendar ISO `yyyy-MM-dd` at noon. */
function todayIsoLocal(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The two statuses the factory floor cares about. */
const WORKER_STATUSES: BackendJobStatus[] = [
  statusToBackend("Ready to Manufacture"),
  statusToBackend("In Fabrication"),
].filter((s): s is BackendJobStatus => s != null);

/**
 * Which backend `JobStatus` enum values belong to each stage-group card.
 *
 * The backend can only filter `GET /jobs` by one status at a time, but a
 * stage-group card represents several statuses at once — so a group filter
 * is served as one backend request per status in the group, merged client
 * side (see `loadGroupJobs` in `JobsList`).
 */
const STAGE_GROUP_BACKEND_STATUSES: Record<JobStageGroup, BackendJobStatus[]> = (() => {
  const groups: Record<JobStageGroup, BackendJobStatus[]> = {
    "not-started": [],
    manufacturing: [],
    delivered: [],
  };
  for (const status of BACKEND_JOB_STATUSES) {
    groups[resolveStatusGroup(statusToUi(status))].push(status);
  }
  return groups;
})();

/** UI sort option → the `JobSort` enum `GET /jobs` accepts. No backend
 *  equivalent for job-id ordering, so it falls back to `RECENT`. */
function toBackendSort(sortBy: JobSortOption): FrpJobSort {
  if (sortBy === "due_asc") return "DUE_DATE";
  if (sortBy === "created_asc") return "OLDEST";
  return "RECENT";
}

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
  const { counts, staff } = useJobs();
  const { isWorker, workerId } = usePersona();
  const { can } = useAuth();
  const canCreateJob = can(ACCESS_KEYS.JOBS_CREATE);
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignedToFilter = parseAssignedToParam(searchParams.get("assignedTo"));
  const duePreset = parseDuePresetParam(searchParams.get("due"));
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">(
    () => (searchParams.get("status") as JobStatus | null) ?? "All"
  );
  const [stageGroupFilter, setStageGroupFilter] = useState<JobStageGroup | null>(
    () => parseStageGroupParam(searchParams.get("group"))
  );
  const [sortBy, setSortBy] = useState<JobSortOption>("created_desc");
  const [page, setPage] = useState(() => {
    const fromUrl = Number(searchParams.get("page"));
    return Number.isFinite(fromUrl) && fromUrl >= 1 ? Math.trunc(fromUrl) : 1;
  });
  const [createJobOpen, setCreateJobOpen] = useState(false);

  // Below 3 characters a job search is too broad to be useful and just adds
  // load — treat it the same as no search until the user has typed enough.
  const effectiveSearchQuery =
    searchQuery.trim().length >= MIN_JOB_SEARCH_LENGTH ? searchQuery : "";

  useEffect(() => {
    const fromUrl = parseStageGroupParam(searchParams.get("group"));
    setStageGroupFilter(fromUrl);
    setSearchQuery(searchParams.get("q") ?? "");
    setStatusFilter((searchParams.get("status") as JobStatus | null) ?? "All");
    const pageFromUrl = Number(searchParams.get("page"));
    setPage(Number.isFinite(pageFromUrl) && pageFromUrl >= 1 ? Math.trunc(pageFromUrl) : 1);
  }, [searchParams]);

  /** Merge-and-replace the current URL's query string — the same pattern
   *  already used by the group filter, extended to status/page. */
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.replace(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
    },
    [router, searchParams]
  );

  const handleStageCardClick = (group: JobStageGroup) => {
    const next = stageGroupFilter === group ? null : group;
    setStageGroupFilter(next);
    setPage(1);
    if (next) {
      setStatusFilter("All");
      updateUrlParams({ group: next, status: null, page: null });
    } else {
      updateUrlParams({ group: null, page: null });
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

  // Skip the very first run — `page` may have just been initialised from the
  // URL (`?page=3`), and resetting it to 1 on mount would throw that away.
  const skipNextPageReset = useRef(true);
  useEffect(() => {
    if (skipNextPageReset.current) {
      skipNextPageReset.current = false;
      return;
    }
    setPage(1);
  }, [effectiveSearchQuery, statusFilter, stageGroupFilter, sortBy]);

  const clearStageGroupFilter = () => {
    setStageGroupFilter(null);
    setPage(1);
    updateUrlParams({ group: null, page: null });
  };

  // ------------------------------------------------------------------
  // Worker mode — GET /jobs?assignedTo=&status=&search= per status in
  // WORKER_STATUSES, merged, then sorted/paginated locally. Same shape as
  // the admin stage-group crawl below: the backend only filters one status
  // per request. This replaced client-filtering the JobsContext snapshot
  // (capped at 200 org-wide jobs), which could silently hide a worker's
  // older assigned jobs for a busy org.
  // ------------------------------------------------------------------

  const [workerRows, setWorkerRows] = useState<Job[]>([]);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isWorker) return;
    let cancelled = false;
    setWorkerLoading(true);
    setWorkerError(null);

    async function loadWorkerJobs() {
      const assignedTo = userIdToBackend(workerId) ?? undefined;
      const parsed = parseNaturalLanguageQuery(effectiveSearchQuery);
      const search =
        [parsed.searchText, parsed.clientHint].filter(Boolean).join(" ").trim() ||
        undefined;
      // MAX_PAGES is a safety net against a runaway loop, not a real cap.
      const MAX_PAGES = 500;
      const collected: Job[] = [];
      for (const status of WORKER_STATUSES) {
        for (let backendPage = 0; backendPage < MAX_PAGES; backendPage++) {
          const res = await listJobs(backendPage, 200, { assignedTo, status, search, sort: "RECENT" });
          collected.push(...(res.content ?? []).map(frpJobSummaryToUi));
          if (res.last || (res.content ?? []).length === 0) break;
        }
      }
      return collected;
    }

    loadWorkerJobs()
      .then((collected) => {
        if (!cancelled) setWorkerRows(collected);
      })
      .catch((e) => {
        if (cancelled) return;
        setWorkerError(e instanceof Error ? e.message : "Could not load jobs");
        setWorkerRows([]);
      })
      .finally(() => {
        if (!cancelled) setWorkerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isWorker, workerId, effectiveSearchQuery]);

  const workerSortedJobs = useMemo(
    () => sortJobs(workerRows, sortBy),
    [workerRows, sortBy]
  );

  const workerPages = totalPages(workerSortedJobs.length, JOBS_PAGE_SIZE);
  const safeWorkerPage = Math.min(page, workerPages);

  const workerPagedJobs = useMemo(
    () => paginateJobs(workerSortedJobs, safeWorkerPage, JOBS_PAGE_SIZE),
    [workerSortedJobs, safeWorkerPage]
  );

  // Worker mode's clamp — admin modes clamp themselves further down.
  useEffect(() => {
    if (!isWorker) return;
    if (page > workerPages) setPage(workerPages);
  }, [isWorker, page, workerPages]);

  // ------------------------------------------------------------------
  // Admin (non-worker) server-driven data. Worker mode keeps using
  // filteredJobs/sortedJobs/pagedJobs above (a small, per-worker dataset
  // from JobsContext) — out of scope for this fix. Everything below only
  // drives the admin table, in one of two modes:
  //  - no stage group selected: one `GET /jobs` request per page/filter/sort
  //    change, using the backend's real pagination.
  //  - a stage group selected: `GET /jobs?status=X` looped once per status
  //    in that group (STAGE_GROUP_BACKEND_STATUSES), merged, then sorted and
  //    paginated locally — the backend has no "any of these statuses" filter,
  //    so this is the closest equivalent without a backend change.
  // ------------------------------------------------------------------

  const [defaultRows, setDefaultRows] = useState<Job[]>([]);
  const [defaultTotalItems, setDefaultTotalItems] = useState(0);
  const [defaultTotalPages, setDefaultTotalPages] = useState(1);
  const [defaultLoading, setDefaultLoading] = useState(false);
  const [defaultError, setDefaultError] = useState<string | null>(null);

  useEffect(() => {
    if (isWorker || stageGroupFilter) return;
    let cancelled = false;
    setDefaultLoading(true);
    setDefaultError(null);

    const parsed = parseNaturalLanguageQuery(effectiveSearchQuery);
    const explicitStatus =
      statusFilter !== "All" ? statusToBackend(statusFilter) ?? undefined : undefined;
    const impliedStatus =
      !explicitStatus && parsed.statusFilter
        ? statusToBackend(parsed.statusFilter) ?? undefined
        : undefined;
    const search =
      [parsed.searchText, parsed.clientHint].filter(Boolean).join(" ").trim() ||
      undefined;
    const priority = parsed.priorityFilter
      ? priorityToBackend(parsed.priorityFilter)
      : undefined;

    const today = todayIsoLocal();
    const dueBefore = duePresetToDueBefore(duePreset, today);

    listJobs(page - 1, JOBS_PAGE_SIZE, {
      search,
      sort: toBackendSort(sortBy),
      status: explicitStatus ?? impliedStatus,
      priority,
      assignedTo: assignedToFilter,
      dueBefore,
    })
      .then((res) => {
        if (cancelled) return;
        setDefaultRows(
          (res.content ?? [])
            .map(frpJobSummaryToUi)
            .filter((job) =>
              shouldKeepJobForDuePreset(duePreset, job.dueDate, today)
            )
        );
        setDefaultTotalItems(res.totalElements ?? 0);
        const total = Math.max(1, res.totalPages ?? 1);
        setDefaultTotalPages(total);
        if (page > total) setPage(total);
      })
      .catch((e) => {
        if (cancelled) return;
        setDefaultError(e instanceof Error ? e.message : "Could not load jobs");
        setDefaultRows([]);
        setDefaultTotalItems(0);
        setDefaultTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) setDefaultLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isWorker,
    stageGroupFilter,
    statusFilter,
    effectiveSearchQuery,
    sortBy,
    page,
    assignedToFilter,
    duePreset,
  ]);

  const [groupRows, setGroupRows] = useState<Job[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  useEffect(() => {
    if (isWorker || !stageGroupFilter) return;
    let cancelled = false;
    setGroupLoading(true);
    setGroupError(null);

    async function loadGroupJobs() {
      // MAX_PAGES is a safety net against a runaway loop, not a real cap.
      const MAX_PAGES = 500;
      const statuses = STAGE_GROUP_BACKEND_STATUSES[stageGroupFilter as JobStageGroup];
      const today = todayIsoLocal();
      const dueBefore = duePresetToDueBefore(duePreset, today);
      const collected: Job[] = [];
      for (const status of statuses) {
        for (let backendPage = 0; backendPage < MAX_PAGES; backendPage++) {
          const res = await listJobs(backendPage, 200, {
            status,
            sort: "RECENT",
            assignedTo: assignedToFilter,
            dueBefore,
          });
          collected.push(...(res.content ?? []).map(frpJobSummaryToUi));
          if (res.last || (res.content ?? []).length === 0) break;
        }
      }
      return collected.filter((job) =>
        shouldKeepJobForDuePreset(duePreset, job.dueDate, today)
      );
    }

    loadGroupJobs()
      .then((collected) => {
        if (!cancelled) setGroupRows(collected);
      })
      .catch((e) => {
        if (cancelled) return;
        setGroupError(e instanceof Error ? e.message : "Could not load jobs");
        setGroupRows([]);
      })
      .finally(() => {
        if (!cancelled) setGroupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isWorker, stageGroupFilter, assignedToFilter, duePreset]);

  const groupFilteredJobs = useMemo(() => {
    if (!stageGroupFilter) return [];
    const parsed = parseNaturalLanguageQuery(effectiveSearchQuery);
    const textQuery = parsed.searchText.toLowerCase();
    if (!textQuery) return groupRows;
    return groupRows.filter((job) => {
      const contactName = (job.clientContactName ?? "").toLowerCase();
      return (
        job.clientName.toLowerCase().includes(textQuery) ||
        job.projectName.toLowerCase().includes(textQuery) ||
        job.id.toLowerCase().includes(textQuery) ||
        contactName.includes(textQuery)
      );
    });
  }, [groupRows, stageGroupFilter, effectiveSearchQuery]);

  const groupSortedJobs = useMemo(
    () => sortJobs(groupFilteredJobs, sortBy),
    [groupFilteredJobs, sortBy]
  );

  const groupPages = totalPages(groupSortedJobs.length, JOBS_PAGE_SIZE);
  const safeGroupPage = Math.min(page, groupPages);
  const groupPagedJobs = useMemo(
    () => paginateJobs(groupSortedJobs, safeGroupPage, JOBS_PAGE_SIZE),
    [groupSortedJobs, safeGroupPage]
  );

  useEffect(() => {
    if (isWorker || !stageGroupFilter) return;
    if (page > groupPages) setPage(groupPages);
  }, [isWorker, stageGroupFilter, page, groupPages]);

  const adminTableJobs = stageGroupFilter ? groupPagedJobs : defaultRows;
  const adminTotalItems = stageGroupFilter ? groupSortedJobs.length : defaultTotalItems;
  const adminTotalPages = stageGroupFilter ? groupPages : defaultTotalPages;
  const adminPage = stageGroupFilter ? safeGroupPage : page;
  const adminError = stageGroupFilter ? groupError : defaultError;

  const displayedJobs = isWorker ? workerPagedJobs : adminTableJobs;
  const displayedTotalItems = isWorker ? workerSortedJobs.length : adminTotalItems;
  const displayedTotalPages = isWorker ? workerPages : adminTotalPages;
  const displayedPage = isWorker ? safeWorkerPage : adminPage;
  const displayedError = isWorker ? workerError : adminError;

  return (
    <div className={`space-y-4 ${isWorker ? "worker-ui" : ""}`}>
      {false && (
        <p className="text-sm text-slate-500">Fabrication programs and stage tracking</p>
      )}

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
            const preview = groupSortedJobs.slice(0, 8);
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
                {groupLoading && groupRows.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">Loading jobs in this stage…</p>
                ) : groupError ? (
                  <p className="mt-3 text-sm text-red-600">{groupError}</p>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {groupSortedJobs.length} job{groupSortedJobs.length === 1 ? "" : "s"} in this
                      stage
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
                              <span className="min-w-0 truncate text-slate-600">
                                {job.clientName}
                              </span>
                              <JobListStageBadges job={job} variant="short" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No jobs in this stage right now.</p>
                    )}
                    {groupSortedJobs.length > preview.length && (
                      <p className="mt-2 text-xs text-slate-500">
                        Showing {preview.length} of {groupSortedJobs.length} — full list in the
                        table below.
                      </p>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </section>
      )}

      {!isWorker && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="inline-flex h-[46px] min-w-0 items-center justify-between rounded-full border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#111827] focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
            <span className="shrink-0">ASSIGNEE</span>
            <select
              value={assignedToFilter != null ? String(assignedToFilter) : ""}
              onChange={(e) => {
                const v = e.target.value;
                setPage(1);
                updateUrlParams({
                  assignedTo: v ? v : null,
                  page: null,
                });
              }}
              className="ml-2 min-w-0 max-w-40 truncate bg-transparent text-[11px] outline-none hover:text-[#EA580C]"
              aria-label="Filter assignee"
            >
              <option value="">Any</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-[46px] min-w-0 items-center justify-between rounded-full border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#111827] focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
            <span className="shrink-0">DUE</span>
            <select
              value={duePreset === "any" ? "" : duePreset}
              onChange={(e) => {
                const v = e.target.value as "" | Exclude<JobListDuePreset, "any">;
                setPage(1);
                updateUrlParams({
                  due: v ? v : null,
                  page: null,
                });
              }}
              className="ml-2 min-w-0 max-w-36 truncate bg-transparent text-[11px] outline-none hover:text-[#EA580C]"
              aria-label="Filter due date"
            >
              <option value="">Any</option>
              <option value="7d">Next 7 days</option>
              <option value="1m">Next 1 month</option>
              <option value="overdue">All overdue</option>
            </select>
          </label>
          <label className="inline-flex h-[46px] min-w-0 items-center justify-between rounded-full border border-[#E5E7EB] bg-white px-3 text-[11px] font-semibold tracking-wide text-[#111827] focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
            <span className="shrink-0">ALL STAGES</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value as JobStatus | "All";
                setStatusFilter(next);
                setStageGroupFilter(null);
                setPage(1);
                updateUrlParams({
                  status: next === "All" ? null : next,
                  group: null,
                  page: null,
                });
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

      {isWorker && workerSortedJobs.length > 0 && (
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

      {!isWorker && !stageGroupFilter && defaultLoading && defaultRows.length === 0 ? (
        <p className="app-card text-center text-base font-medium text-slate-600">
          Loading jobs…
        </p>
      ) : !isWorker && stageGroupFilter && groupLoading && groupRows.length === 0 ? (
        <p className="app-card text-center text-base font-medium text-slate-600">
          Loading jobs…
        </p>
      ) : isWorker && workerLoading && workerRows.length === 0 ? (
        <p className="app-card text-center text-base font-medium text-slate-600">
          Loading jobs…
        </p>
      ) : displayedError ? (
        <p className="app-card text-center text-base font-medium text-red-600">{displayedError}</p>
      ) : displayedTotalItems === 0 ? (
        <p className="app-card text-center text-base font-medium text-slate-600">
          {isWorker
            ? "No assigned jobs on the floor right now. Check back later."
            : stageGroupFilter
              ? `No jobs in ${STAGE_GROUP_INFO[stageGroupFilter].label} match your search. Clear filters or try another stage.`
              : "No jobs match your filters. Try clearing search or selecting another stage."}
        </p>
      ) : (
        <>
          <JobsTable jobs={displayedJobs} workerMode={isWorker} />
          <JobsCards jobs={displayedJobs} workerMode={isWorker} />
          <JobsPagination
            page={displayedPage}
            totalPages={displayedTotalPages}
            pageSize={JOBS_PAGE_SIZE}
            totalItems={displayedTotalItems}
            onPageChange={(next) => {
              setPage(next);
              updateUrlParams({ page: next > 1 ? String(next) : null });
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
      <div className="overflow-auto">
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
