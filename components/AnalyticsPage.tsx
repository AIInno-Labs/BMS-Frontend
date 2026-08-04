"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft } from "lucide-react";
import { AnimatedStatTile } from "@/components/analytics/AnimatedStatTile";
import {
  ANALYTICS_POLL_MS,
  AnalyticsRefreshControl,
  readAutoRefreshPreference,
  writeAutoRefreshPreference,
} from "@/components/analytics/AnalyticsRefreshControl";
import { useJobs } from "@/context/JobsContext";
import {
  computeJobAnalytics,
  fabricationTrend,
  jobsCreatedTrend,
  readyManufactureTrend,
} from "@/lib/analytics/jobMetrics";
import {
  emptyAnalyticsSnapshot,
  type AnalyticsSnapshot,
} from "@/lib/analytics/types";
import { formatCreatedDate } from "@/lib/jobData";
import { STATUS_THEME } from "@/lib/statusColors";
import { journeyOutcomeLabel } from "@/lib/quotes/labels";

const STATUS_COLORS: Record<string, string> = {
  Pending: STATUS_THEME.notStarted.strong,
  "Awaiting Manager Approval": STATUS_THEME.notStarted.strong,
  "Ready to Manufacture": STATUS_THEME.notStarted.soft,
  "In Fabrication": STATUS_THEME.manufacturing.strong,
  "On Hold": STATUS_THEME.notStarted.soft,
  Complete: STATUS_THEME.delivered.strong,
  Cancelled: STATUS_THEME.notStarted.strong,
};

const STATUS_SHORT: Record<string, string> = {
  Pending: "Pending",
  "Awaiting Manager Approval": "Awaiting",
  "Ready to Manufacture": "Ready",
  "In Fabrication": "In fab",
  "On Hold": "On hold",
  Complete: "Complete",
  Cancelled: "Cancelled",
};

const QUOTIENT_LABELS: Record<string, string> = {
  quote_sent: "Quote sent",
  customer_viewed: "Customer viewed",
  customer_question: "Customer question",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  quote_completed: "Quote completed",
};

const QUOTIENT_COLORS: Record<string, string> = {
  quote_sent: STATUS_THEME.notStarted.soft,
  customer_viewed: STATUS_THEME.notStarted.strong,
  customer_question: STATUS_THEME.notStarted.soft,
  quote_accepted: STATUS_THEME.manufacturing.strong,
  quote_declined: STATUS_THEME.notStarted.strong,
  quote_completed: STATUS_THEME.delivered.strong,
};

type JobDeltas = {
  total: number | null;
  ready: number | null;
  rush: number | null;
  overdue: number | null;
  awaiting: number | null;
  inFab: number | null;
  withAlerts: number | null;
};

function trendToday(trend: number[]): string | null {
  const n = trend[trend.length - 1] ?? 0;
  return n > 0 ? `${n} in last 24h window` : null;
}

export function AnalyticsPage() {
  const { jobs, loading: jobsLoading, refreshJobs } = useJobs();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [jobDeltas, setJobDeltas] = useState<JobDeltas>({
    total: null,
    ready: null,
    rush: null,
    overdue: null,
    awaiting: null,
    inFab: null,
    withAlerts: null,
  });
  const [quotientDelta, setQuotientDelta] = useState<number | null>(null);

  const prevJobsRef = useRef<ReturnType<typeof computeJobAnalytics> | null>(null);
  const prevQuotientRef = useRef<number | null>(null);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;

  useEffect(() => {
    setAutoRefresh(readAutoRefreshPreference());
  }, []);

  const loadAnalytics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Quote/inventory analytics move with DEL-02; job KPIs come from JobsContext.
      const data = emptyAnalyticsSnapshot();
      setSnapshot(data);

      const total = data.quotientTotal ?? 0;
      if (prevQuotientRef.current != null) {
        setQuotientDelta(total - prevQuotientRef.current);
      }
      prevQuotientRef.current = total;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load analytics");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const jobStats = useMemo(() => computeJobAnalytics(jobs), [jobs]);

  const recordJobPulse = useCallback((stats: ReturnType<typeof computeJobAnalytics>) => {
    const prev = prevJobsRef.current;
    if (prev) {
      setJobDeltas({
        total: stats.total - prev.total,
        ready: stats.ready - prev.ready,
        rush: stats.rush - prev.rush,
        overdue: stats.overdue - prev.overdue,
        awaiting: stats.awaiting - prev.awaiting,
        inFab: stats.inFab - prev.inFab,
        withAlerts: stats.withAlerts - prev.withAlerts,
      });
    }
    prevJobsRef.current = stats;
    setSyncTick((t) => t + 1);
  }, []);

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setRefreshing(true);
      setError(null);
      try {
        const [list] = await Promise.all([
          refreshJobs({ silent: true }),
          loadAnalytics(true),
        ]);
        recordJobPulse(computeJobAnalytics(list));
        setLastUpdated(new Date());
      } catch {
        /* errors surfaced via context / loadAnalytics */
      } finally {
        setRefreshing(false);
        if (!silent) setLoading(false);
      }
    },
    [loadAnalytics, recordJobPulse, refreshJobs]
  );

  useEffect(() => {
    void refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const id = window.setInterval(() => {
      void refreshAll(true);
    }, ANALYTICS_POLL_MS);

    return () => clearInterval(id);
  }, [autoRefresh, refreshAll]);

  const createdTrend = useMemo(() => jobsCreatedTrend(jobs), [jobs]);
  const readyTrend = useMemo(() => readyManufactureTrend(jobs), [jobs]);
  const fabTrend = useMemo(() => fabricationTrend(jobs), [jobs]);

  const statusChartData = useMemo(
    () =>
      Object.entries(jobStats.byStatus).map(([status, count]) => ({
        status: STATUS_SHORT[status] ?? status,
        count,
        fill: STATUS_COLORS[status] ?? STATUS_THEME.notStarted.soft,
      })),
    [jobStats.byStatus]
  );

  const resinChartData = useMemo(
    () =>
      Object.entries(jobStats.resinMix).map(([resin, count], index) => ({
        resin: resin.split(" ")[0],
        count,
        fill: [
          STATUS_THEME.notStarted.strong,
          STATUS_THEME.manufacturing.strong,
          STATUS_THEME.delivered.strong,
        ][index % 3],
      })),
    [jobStats.resinMix]
  );

  const quotientChartData = useMemo(
    () =>
      (snapshot?.quotientEvents ?? []).map((e) => ({
        name: QUOTIENT_LABELS[e.event_name] ?? e.event_name,
        count: e.count,
        fill: QUOTIENT_COLORS[e.event_name] ?? STATUS_THEME.notStarted.soft,
      })),
    [snapshot?.quotientEvents]
  );

  const sent = snapshot?.quotientEvents.find((e) => e.event_name === "quote_sent")?.count ?? 0;
  const accepted =
    snapshot?.quotientEvents.find((e) => e.event_name === "quote_accepted")?.count ?? 0;
  const conversionPct = sent > 0 ? Math.round((accepted / sent) * 100) : null;

  const handleAutoRefreshChange = (enabled: boolean) => {
    setAutoRefresh(enabled);
    writeAutoRefreshPreference(enabled);
    if (enabled) void refreshAll(true);
  };

  const handleManualRefresh = () => {
    void refreshAll(false);
  };

  const live = autoRefresh;

  return (
    <main className="app-mesh-bg relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="app-mesh-pattern pointer-events-none fixed inset-0 opacity-[0.35]" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl">
        {/* Landing view: header + 2-row KPIs + charts only */}
        <div className="analytics-landing flex min-h-[calc(100dvh-8.75rem)] flex-col overflow-hidden px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="btn-ghost !px-3 !py-1.5 text-sm"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                Analytics
                {live && (
                  <span className="ml-2 text-sm font-medium text-emerald-600">· live</span>
                )}
              </h1>
            </div>
          </div>
          <AnalyticsRefreshControl
            compact
            autoRefresh={autoRefresh}
            onAutoRefreshChange={handleAutoRefreshChange}
            onRefresh={handleManualRefresh}
            refreshing={refreshing || loading}
            lastUpdated={lastUpdated}
          />
        </div>

        {(error || jobsLoading) && (
          <p className="mb-1.5 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error ?? "Loading job data…"}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <section className="shrink-0" aria-label="Operations KPIs">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Fabrication overview</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AnimatedStatTile
              label="Active jobs"
              value={jobStats.total}
              hint={
                trendToday(createdTrend) ?? "All programs in system"
              }
              trend={createdTrend}
              delta={jobDeltas.total}
              live={live}
              pulseKey={`${syncTick}-total`}
            />
            <AnimatedStatTile
              label="Ready to build"
              value={jobStats.ready}
              hint={`${jobStats.readyPct}% of queue cleared`}
              accent="amber"
              trend={readyTrend}
              delta={jobDeltas.ready}
              live={live}
              pulseKey={`${syncTick}-ready`}
            />
            <AnimatedStatTile
              label="RUSH programs"
              value={jobStats.rush}
              hint={
                jobStats.rush > 0
                  ? "Priority escalation active"
                  : "No rush flags right now"
              }
              accent="amber"
              trend={createdTrend}
              delta={jobDeltas.rush}
              live={live}
              pulseKey={`${syncTick}-rush`}
            />
            <AnimatedStatTile
              label="Overdue"
              value={jobStats.overdue}
              hint={
                jobStats.overdue > 0
                  ? "Requires schedule attention"
                  : "Past due date, not complete"
              }
              accent={jobStats.overdue > 0 ? "red" : "slate"}
              trend={createdTrend}
              delta={jobDeltas.overdue}
              live={live}
              pulseKey={`${syncTick}-overdue`}
            />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AnimatedStatTile
              label="Awaiting approval"
              value={jobStats.awaiting}
              hint="Pending manager sign-off"
              trend={createdTrend}
              delta={jobDeltas.awaiting}
              live={live}
              pulseKey={`${syncTick}-awaiting`}
            />
            <AnimatedStatTile
              label="On the floor"
              value={jobStats.inFab}
              hint={
                trendToday(fabTrend) ?? "In fabrication now"
              }
              accent="amber"
              trend={fabTrend}
              delta={jobDeltas.inFab}
              live={live}
              pulseKey={`${syncTick}-infab`}
            />
            <AnimatedStatTile
              label="With alerts"
              value={jobStats.withAlerts}
              hint={
                jobStats.withAlerts > 0
                  ? "Material or schedule flags"
                  : "No active alert flags"
              }
              accent={jobStats.withAlerts > 0 ? "amber" : "slate"}
              trend={createdTrend}
              delta={jobDeltas.withAlerts}
              live={live}
              pulseKey={`${syncTick}-alerts`}
            />
            <AnimatedStatTile
              label="Avg est. hours"
              value={jobStats.avgHours ?? "—"}
              hint="Across jobs with estimates"
              live={live}
              pulseKey={`${syncTick}-hours`}
            />
            </div>
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2">
            <section
              className="analytics-chart-card flex min-h-0 flex-col"
              aria-label="Jobs by status"
            >
              <div className="shrink-0">
                <h2 className="text-sm font-semibold text-slate-900">Pipeline by status</h2>
                <p className="text-xs text-slate-500">Fabrication lifecycle</p>
              </div>
              <div className="mt-1 min-h-[120px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusChartData}
                    margin={{ top: 4, right: 4, left: -18, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      interval={0}
                      angle={-32}
                      textAnchor="end"
                      height={44}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={700}
                      animationEasing="ease-out"
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section
              className="analytics-chart-card flex min-h-0 flex-col"
              aria-label="Resin mix"
            >
              <div className="shrink-0">
                <h2 className="text-sm font-semibold text-slate-900">Resin mix</h2>
                <p className="text-xs text-slate-500">
                  Programs by resin system — bottom scale is{" "}
                  <span className="font-medium text-slate-600">job count</span> (0, 15, 30…
                  = number of active jobs using that resin).
                </p>
              </div>
              <div className="mt-1 min-h-[120px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={resinChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis
                      type="category"
                      dataKey="resin"
                      width={64}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} jobs`, "Count"]}
                      labelFormatter={(resin) => `${resin} resin`}
                    />
                    <Bar
                      dataKey="count"
                      radius={[0, 4, 4, 0]}
                      isAnimationActive
                      animationDuration={700}
                    >
                      {resinChartData.map((row) => (
                        <Cell key={row.resin} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
        </div>

        {/* Below the fold — scroll down to see */}
        <div className="space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <section className="app-card" aria-label="Quotient analytics">
          <h2 className="text-lg font-semibold text-slate-900">Quotient quote journey</h2>
          <p className="mt-1 text-base text-slate-600">
            All webhook events from <code className="text-sm">quote_events_history</code>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <AnimatedStatTile
              label="Total events logged"
              value={snapshot?.quotientTotal ?? (loading ? "…" : 0)}
              hint="Permanent archive rows"
              delta={quotientDelta}
              live={live}
              pulseKey={`${syncTick}-quotient`}
            />
            <AnimatedStatTile
              label="Quotes accepted"
              value={accepted}
              hint="Operational jobs triggered"
              accent="amber"
              live={live}
            />
            <AnimatedStatTile
              label="Acceptance rate"
              value={conversionPct != null ? `${conversionPct}%` : "—"}
              hint={sent > 0 ? `From ${sent} quotes sent` : "No quote_sent events yet"}
              accent="delivered"
              live={live}
            />
          </div>
          <div className="mt-4 h-56">
            {quotientChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quotientChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    radius={[6, 6, 0, 0]}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {quotientChartData.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-base text-slate-500">
                {loading
                  ? "Loading Quotient events…"
                  : "No Quotient events yet — history fills when webhooks arrive."}
              </p>
            )}
          </div>
          {snapshot && snapshot.recentQuotientEvents.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[820px] text-left text-base">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">When</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Quote</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Event</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Journey</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">System Logged</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Factory Done</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recentQuotientEvents.map((ev, i) => {
                    const journey = ev.journey_outcome ?? "open";
                    const factory = ev.factory_job_status;
                    const factoryDone =
                      factory === "Complete" || factory === "Cancelled";
                    const systemLogged = ev.job_logged === true;
                    return (
                    <tr
                      key={ev.id}
                      className={`border-b border-slate-100 transition-colors duration-500 ${
                        i === 0 && live ? "bg-amber-50/80" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-600">
                        {formatCreatedDate(ev.created_at)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <Link
                          href={`/quotes/${encodeURIComponent(ev.quotient_id)}`}
                          className="text-[#F59E0B] hover:underline"
                        >
                          #{ev.quotient_id}
                        </Link>
                        {ev.title && (
                          <span className="mt-0.5 block text-sm font-normal text-slate-500">
                            {ev.title}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-800">
                          {QUOTIENT_LABELS[ev.event_name] ?? ev.event_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            journey === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : journey === "declined"
                                ? "bg-red-100 text-red-800"
                                : journey === "accepted"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-red-50 text-red-700"
                          }`}
                        >
                          {journeyOutcomeLabel(journey)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            systemLogged
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}
                          title={
                            systemLogged
                              ? "JOB-Q job exists in Jobs tab"
                              : "Not created in Jobs yet (quote_accepted not received)"
                          }
                        >
                          {systemLogged ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!systemLogged ? (
                          <span className="text-sm text-slate-500">—</span>
                        ) : (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                              factoryDone
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                            title="Factory workflow status on job card"
                          >
                            {factoryDone ? "Yes" : "No"}
                            {factory && !factoryDone && (
                              <span className="font-normal text-slate-600">
                                {" "}
                                ({factory})
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="app-card" aria-label="Top clients">
            <h2 className="text-lg font-semibold text-slate-900">Top clients</h2>
            <p className="mt-1 text-base text-slate-600">By active job count</p>
            <ul className="mt-4 space-y-2">
              {jobStats.topClients.map(({ name, count }, i) => (
                <li
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 transition-all duration-300 hover:border-slate-200"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  <span className="font-medium text-slate-900">{name}</span>
                  <span className="font-semibold tabular-nums text-[#F59E0B]">{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="app-card" id="inventory" aria-label="Inventory alerts">
            <h2 className="text-lg font-semibold text-slate-900">Inventory reorder alerts</h2>
            <p className="mt-1 text-base text-slate-600">
              SKUs at or below reorder level
              {snapshot != null && (
                <span className="font-semibold text-[#F59E0B]">
                  {" "}
                  · {snapshot.inventoryReorderCount} items
                </span>
              )}
            </p>
            {snapshot && snapshot.inventoryLowStock.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {snapshot.inventoryLowStock.map((item) => (
                  <li
                    key={item.sku_code}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 transition-shadow duration-300 hover:shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">{item.description_1}</p>
                    <p className="text-sm text-slate-600">
                      {item.sku_code} · On hand {item.stock_quantity} / reorder{" "}
                      {item.reorder_level}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-base text-slate-600">
                {loading ? "Checking stock levels…" : "No reorder alerts — stock levels OK."}
              </p>
            )}
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
