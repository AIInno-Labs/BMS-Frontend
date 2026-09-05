"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Layers, Sparkles } from "lucide-react";
import { DashboardKpiCards } from "@/components/DashboardKpiCards";
import { LaborCommandCenterDrawer } from "@/components/LaborCommandCenterDrawer";
import { ReadyToManufacturePieChart } from "@/components/ReadyToManufacturePieChart";
import { useJobs } from "@/context/JobsContext";
import { usePersona } from "@/context/PersonaContext";
import { useAuth } from "@/context/AuthContext";
import { listJobs, listUpcomingDueJobs } from "@/lib/frp/api";
import { frpJobSummaryToUi } from "@/lib/frp/job-mapper";
import { formatShortDate } from "@/lib/jobData";
import type { Job } from "@/lib/types";

function isActiveJob(job: Job): boolean {
  return job.status !== "Complete" && job.status !== "Cancelled";
}

/**
 * Row-by-row visibility for the Recent Jobs list, keyed by viewport height
 * rather than a fixed count - the first 4 rows always show, and each
 * further row only appears once the screen is tall enough to fit it.
 * Literal class strings required for Tailwind's scanner.
 */
const RECENT_JOB_ROW_VISIBILITY_BLOCK = [
  "block",
  "block",
  "block",
  "block",
  "hidden [@media(min-height:600px)]:block",
  "hidden [@media(min-height:700px)]:block",
  "hidden [@media(min-height:800px)]:block",
  "hidden [@media(min-height:900px)]:block",
  "hidden [@media(min-height:1000px)]:block",
  "hidden [@media(min-height:1100px)]:block",
] as const;

const RECENT_JOB_ROW_VISIBILITY_TABLE_ROW = [
  "table-row",
  "table-row",
  "table-row",
  "table-row",
  "hidden [@media(min-height:600px)]:table-row",
  "hidden [@media(min-height:700px)]:table-row",
  "hidden [@media(min-height:800px)]:table-row",
  "hidden [@media(min-height:900px)]:table-row",
  "hidden [@media(min-height:1000px)]:table-row",
  "hidden [@media(min-height:1100px)]:table-row",
] as const;

const UPCOMING_DUE_LIMIT = 4;
const RECENT_JOBS_LIMIT = 10;
/** Org-wide upcoming + overdue table (generic, not assignee-scoped). */
const ORG_DUE_LIST_LIMIT = 10;
const DUE_WINDOW_MONTHS = 3;

function todayIso(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** ISO date shifted by calendar months (local noon). */
function isoDatePlusMonths(months: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Strictly past, matching `JobRepository.countOverdue`'s `dueDate < :today` —
 * the KPI card and this list have to agree on what overdue means, or the count
 * and the rows below it differ by however many jobs fall due today.
 *
 * The request's `dueBefore=today` ceiling is inclusive, so today's jobs do
 * arrive and are dropped here on purpose. A job due today has not missed its
 * deadline yet; it belongs to Upcoming Due, whose floor is today.
 */
function isOverdueDueDate(dueDate: string | null | undefined, today: string): boolean {
  return !!dueDate && dueDate < today;
}

function pickOverdueJobs(jobs: Job[], today: string, limit: number): Job[] {
  return jobs
    .filter((job) => isOverdueDueDate(job.dueDate, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, limit);
}

function pickPriorityQueue(allJobs: Job[]): Job[] {
  return [...allJobs]
    .filter((job) => isActiveJob(job) && (job.priority !== "Normal" || job.alert))
    .sort((a, b) => {
      const rank = (j: Job) =>
        j.priority === "RUSH" ? 3 : j.priority === "High" ? 2 : 1;
      return rank(b) - rank(a);
    })
    .slice(0, 4);
}

export function Dashboard() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRebalanceFocus, setDrawerRebalanceFocus] = useState(false);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [orgDueJobs, setOrgDueJobs] = useState<Job[]>([]);
  const { isManager } = usePersona();
  const { user } = useAuth();
  const myUserId = user?.id ?? null;
  const { jobs, counts } = useJobs();
  const recentUpdates = useMemo(() => recentJobs.slice(0, 3), [recentJobs]);
  const priorityQueue = useMemo(() => pickPriorityQueue(jobs), [jobs]);
  // Every count below is org-wide, from GET /jobs/counts — not a tally of the
  // page this browser happens to have loaded.
  const delayedCount = counts.overdue;
  const readyCount = counts.ready;
  const fabricationCount = counts.manufacturing;
  const awaitingCount = counts.awaitingApproval;
  const totalActive = counts.active || 1;

  // Jobs assigned to the signed-in user only.
  useEffect(() => {
    if (myUserId == null) {
      setUpcomingJobs([]);
      setRecentJobs([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      // The server applies the date floor, the active filter and the limit, so
      // nothing here has to trim the result. Asking /jobs with dueBefore
      // instead returned everything already overdue, soonest-first — so this
      // panel showed the oldest misses rather than the next deadlines.
      listUpcomingDueJobs({ limit: UPCOMING_DUE_LIMIT, assignedTo: myUserId }),
      listJobs(0, RECENT_JOBS_LIMIT, {
        sort: "RECENT",
        assignedTo: myUserId,
      }),
    ])
      .then(([dueJobs, recentPage]) => {
        if (cancelled) return;
        setUpcomingJobs(dueJobs.map(frpJobSummaryToUi));
        setRecentJobs(
          (recentPage.content ?? [])
            .map(frpJobSummaryToUi)
            .slice(0, RECENT_JOBS_LIMIT)
        );
      })
      .catch(() => {
        if (!cancelled) {
          setUpcomingJobs([]);
          setRecentJobs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  // Org-wide overdue only (dueDate < today), ±3 month lower bound, max 10.
  useEffect(() => {
    if (!isManager) {
      setOrgDueJobs([]);
      return;
    }
    let cancelled = false;
    const today = todayIso();
    const earliestDue = isoDatePlusMonths(-DUE_WINDOW_MONTHS);
    void listJobs(0, 200, {
      sort: "DUE_DATE",
      dueBefore: today,
    })
      .then((page) => {
        if (cancelled) return;
        const candidates = (page.content ?? [])
          .map(frpJobSummaryToUi)
          .filter(
            (job) =>
              isActiveJob(job) &&
              !!job.dueDate &&
              job.dueDate >= earliestDue
          );
        setOrgDueJobs(pickOverdueJobs(candidates, today, ORG_DUE_LIST_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setOrgDueJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isManager]);

  const openDrawer = (rebalance = false) => {
    setDrawerRebalanceFocus(rebalance);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerRebalanceFocus(false);
  };

  const deliveredCount = counts.delivered;
  // Same buckets as the KPI cards — do not fold awaiting/ready into "not started".
  const manufacturingNowCount = counts.manufacturing + counts.ready;
  const notStartedCount = counts.notStarted;
  const breakdownTotal = Math.max(
    1,
    deliveredCount + manufacturingNowCount + notStartedCount + counts.awaitingApproval
  );
  const breakdownSegments = [
    { label: "DELIVERED", value: deliveredCount, color: "#10B981" },
    { label: "MANUFACTURING", value: manufacturingNowCount, color: "#F59E0B" },
    { label: "AWAITING", value: counts.awaitingApproval, color: "#8B5CF6" },
    { label: "NOT STARTED", value: notStartedCount, color: "#EF4444" },
  ];
  const donutRadius = 34;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let cumulativeOffset = 0;
  const breakdownArcs = breakdownSegments.map((segment) => {
    const fraction = segment.value / breakdownTotal;
    const length = fraction * donutCircumference;
    const arc = {
      ...segment,
      percent: Math.round((segment.value / breakdownTotal) * 100),
      dasharray: `${Math.max(length, 0)} ${Math.max(donutCircumference - length, 0)}`,
      dashoffset: -cumulativeOffset,
    };
    cumulativeOffset += length;
    return arc;
  });

  return (
    <>
      <main className="app-mesh-bg relative flex w-full shrink-0 grow-0 flex-col overflow-x-hidden">
        <div
          className="app-mesh-pattern pointer-events-none absolute inset-0 opacity-[0.4]"
          aria-hidden
        />

        <div className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-col px-4 py-2 sm:px-6 sm:py-2.5 lg:px-8">
          {isManager && (
            <section className="mb-2.5">
              <DashboardKpiCards />
            </section>
          )}

          <section
            className={`grid w-full min-w-0 items-start gap-3 ${
              myUserId != null
                ? "md:grid-cols-2 xl:grid-cols-[1.35fr_0.65fr] xl:items-stretch"
                : "mx-auto w-full max-w-xl"
            }`}
            aria-label="Operational overview"
          >
            <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="border-b border-slate-100 pb-1.5">
                <h2 className="text-sm font-semibold text-slate-900">Jobs Breakdown</h2>
              </div>
              <div className="mt-1.5 grid items-center gap-2 sm:grid-cols-[156px_minmax(0,1fr)]">
                <div className="relative mx-auto h-[98px] w-[98px]">
                  <svg viewBox="0 0 110 110" className="-rotate-90">
                    <circle cx="55" cy="55" r={donutRadius} fill="none" strokeWidth="20" className="stroke-slate-200" />
                    {breakdownArcs.map((arc) => (
                      <circle
                        key={arc.label}
                        cx="55"
                        cy="55"
                        r={donutRadius}
                        fill="none"
                        strokeWidth="20"
                        stroke={arc.color}
                        strokeDasharray={arc.dasharray}
                        strokeDashoffset={arc.dashoffset}
                      />
                    ))}
                  </svg>
                </div>
                <div className="space-y-1.5">
                  {breakdownArcs.map((arc) => (
                    <div
                      key={`${arc.label}-row`}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: arc.color }}
                          aria-hidden
                        />
                        {arc.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{arc.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <details className="mt-1.5 hidden rounded-md border border-slate-200 bg-white">
                <summary className="cursor-pointer px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Advanced metrics
                </summary>
                <div className="border-t border-slate-100 px-2.5 py-1.5">
                  <ReadyToManufacturePieChart jobs={jobs} compact />
                  <div className="mt-1.5 grid grid-cols-3 gap-1">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px]">
                      <p className="font-semibold text-slate-500">Awaiting</p>
                      <p className="font-semibold text-slate-900">{awaitingCount}</p>
                    </div>
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px]">
                      <p className="font-semibold text-amber-700">Ready</p>
                      <p className="font-semibold text-amber-900">{readyCount}</p>
                    </div>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px]">
                      <p className="font-semibold text-emerald-700">Fabrication</p>
                      <p className="font-semibold text-emerald-900">{fabricationCount}</p>
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {[
                      { label: "Awaiting", value: awaitingCount, color: "bg-red-500" },
                      { label: "Ready", value: readyCount, color: "bg-amber-500" },
                      { label: "Fabrication", value: fabricationCount, color: "bg-amber-500" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-0.5 flex items-center justify-between text-[10px]">
                          <span className="font-medium text-slate-700">{row.label}</span>
                          <span className="text-slate-600">
                            {Math.round((row.value / totalActive) * 100)}%
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${row.color}`}
                            style={{ width: `${Math.max(6, Math.round((row.value / totalActive) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </section>

            {myUserId != null && (
              <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm" aria-label="Upcoming due">
                <div className="border-b border-slate-100 pb-1.5">
                  <h2 className="text-sm font-semibold text-slate-900">Upcoming Due</h2>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {upcomingJobs.length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      No jobs assigned to you with a due date.
                    </p>
                  ) : (
                    upcomingJobs.map((job) => (
                      <Link
                        key={`due-${job.id}`}
                        href={`/jobs/${job.id}`}
                        className="block rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 hover:bg-slate-100"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">{job.id}</p>
                            <p className="truncate text-[10px] text-slate-500">{job.clientName}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold text-slate-600">
                            {formatShortDate(job.dueDate)}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <details className="mt-2 hidden rounded-md border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    Queue details
                  </summary>
                  <div className="space-y-1 border-t border-slate-100 px-2.5 py-1.5">
                    <p className="text-[11px] text-slate-600">
                      Delayed: <span className="font-semibold text-slate-900">{delayedCount}</span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Priority queue: <span className="font-semibold text-slate-900">{priorityQueue.length}</span>
                    </p>
                    <div className="space-y-1">
                      {recentUpdates.map((job) => (
                        <Link
                          key={`update-${job.id}`}
                          href={`/jobs/${job.id}`}
                          className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-700">{job.id}</span>
                          <span className="text-slate-500">{job.status}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </details>
              </section>
            )}
          </section>

          {myUserId != null && (
            <section
              className="mt-3 mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              aria-label="Recent jobs"
            >
              <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                      Recent Jobs
                    </h2>
                    {false && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        Latest programs entering the fabrication pipeline.
                      </p>
                    )}
                  </div>
                  <Link
                    href="/jobs"
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-amber-700"
                  >
                    View All →
                  </Link>
                </div>
              </div>
              {recentJobs.length === 0 ? (
                <p className="m-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                  No jobs assigned to you yet.
                </p>
              ) : (
                <>
              <div className="space-y-1 p-2.5 lg:hidden">
                {recentJobs.map((job, index) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className={`${RECENT_JOB_ROW_VISIBILITY_BLOCK[index] ?? "hidden"} rounded-md border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900">{job.id}</p>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        {job.priority}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-700">{job.clientName}</p>
                    <p className="text-[11px] text-slate-500">{job.status}</p>
                  </Link>
                ))}
              </div>
              <div className="hidden min-w-0 lg:block">
                <div className="overflow-auto">
                  <table className="w-full min-w-[620px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">Job</th>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">Client</th>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">Project / Description</th>
                      <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {recentJobs.map((job, index) => (
                      <tr
                        key={job.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Open job ${job.id}`}
                        onClick={() => router.push(`/jobs/${job.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/jobs/${job.id}`);
                          }
                        }}
                        className={`${RECENT_JOB_ROW_VISIBILITY_TABLE_ROW[index] ?? "hidden"} cursor-pointer hover:bg-slate-50/70`}
                      >
                        <td className="px-3 py-1.5 font-medium text-slate-900">
                          {job.id}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">{job.clientName}</td>
                        <td className="px-3 py-1.5 text-slate-700">{job.projectName}</td>
                        <td className="px-3 py-1.5 text-right text-slate-700">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
                </>
              )}
            </section>
          )}

          {isManager && (
            <section
              className="mt-3 mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              aria-label="Overdue jobs"
            >
              <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                      Overdue Jobs
                    </h2>
                  </div>
                  <Link
                    href="/jobs"
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-amber-700"
                  >
                    View All →
                  </Link>
                </div>
              </div>
              {orgDueJobs.length === 0 ? (
                <p className="m-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                  No overdue jobs in the ±{DUE_WINDOW_MONTHS} month window.
                </p>
              ) : (
                <>
                  <div className="space-y-1 p-2.5 lg:hidden">
                    {orgDueJobs.map((job, index) => (
                      <Link
                        key={`org-due-${job.id}`}
                        href={`/jobs/${job.id}`}
                        className={`${RECENT_JOB_ROW_VISIBILITY_BLOCK[index] ?? "hidden"} rounded-md border border-slate-200 bg-white px-2.5 py-1 hover:bg-slate-50`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            {job.id}
                          </p>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            {job.priority}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-700">
                          {job.clientName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Due {formatShortDate(job.dueDate)} · {job.status}
                        </p>
                      </Link>
                    ))}
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <div className="overflow-auto">
                      <table className="w-full min-w-[620px] text-left">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">
                              Job
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">
                              Client
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">
                              Project / Description
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold">
                              Due
                            </th>
                            <th className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 font-semibold text-right">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                          {orgDueJobs.map((job, index) => (
                            <tr
                              key={`org-due-row-${job.id}`}
                              role="link"
                              tabIndex={0}
                              aria-label={`Open job ${job.id}`}
                              onClick={() => router.push(`/jobs/${job.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  router.push(`/jobs/${job.id}`);
                                }
                              }}
                              className={`${RECENT_JOB_ROW_VISIBILITY_TABLE_ROW[index] ?? "hidden"} cursor-pointer hover:bg-slate-50/70`}
                            >
                              <td className="px-3 py-1.5 font-medium text-slate-900">
                                {job.id}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {job.clientName}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {job.projectName}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {formatShortDate(job.dueDate)}
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-700">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                  {job.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          <details className="hidden">
            <summary className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-600">
              Additional controls
            </summary>
            <div className="grid gap-1.5 border-t border-slate-100 px-3 py-2 sm:grid-cols-3">
              <Link
                href="/jobs"
                className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
              >
                <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {isManager ? "View Fabrication Jobs" : "My Assigned Work"}
              </Link>
              {isManager && (
                <>
                  <button
                    type="button"
                    onClick={() => openDrawer(false)}
                    className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Scheduling
                  </button>
                  <button
                    type="button"
                    onClick={() => openDrawer(true)}
                    className="inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    AI Rebalance
                  </button>
                </>
              )}
            </div>
          </details>

          <section
            className="hidden"
            aria-label="Compact footer"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-600">
                Operational overview in compact ERP mode.
              </p>
              <Link
                href="/jobs"
                className="inline-flex min-h-[28px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Open Jobs
              </Link>
            </div>
          </section>
        </div>
      </main>

      {isManager && (
        <LaborCommandCenterDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          focusRebalance={drawerRebalanceFocus}
        />
      )}
    </>
  );
}
