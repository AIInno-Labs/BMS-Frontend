"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft } from "lucide-react";
import { AnimatedStatTile } from "@/components/analytics/AnimatedStatTile";
import { fetchAllJobs } from "@/lib/crm/fetch-all-jobs";
import { formatCreatedDate, formatShortDate } from "@/lib/jobData";
import {
  getCrmJobPipeline,
  getCrmOverview,
  getCrmQuestions,
  getJobPaymentHistory,
  getQuoteEventCounts,
  listQuotes,
  type FrpCrmJobPipelineDTO,
  type FrpCrmOverviewDTO,
  type FrpCrmQuestionDTO,
  type FrpJobPaymentHistoryDTO,
  type FrpPeriodUnit,
} from "@/lib/frp/api";
import { mapQuoteRow } from "@/lib/quotient/map-quote-row";
import type { QuoteListItem } from "@/lib/quotient/quote-types";
import type { PageResponse } from "@/lib/frp/types";
import { STATUS_THEME } from "@/lib/statusColors";
import { useAuth } from "@/context/AuthContext";
import { formatMoney, fromCents } from "@/lib/frp/format-money";
import type { Job } from "@/lib/types";

// One distinct color per possible jobStageLabel() result — draft through
// completed, the coarse fallback labels, then cancelled. A real customer's
// jobs will usually only hit a handful of these, but every slice a pie can
// show gets its own hue rather than reusing one across several stages.
const JOB_STAGE_COLORS: Record<string, string> = {
  Draft: "#F97316",
  Drawing: "#F59E0B",
  Approval: "#EAB308",
  Production: "#3B82F6",
  QC: "#6366F1",
  Dispatch: "#8B5CF6",
  Completed: "#10B981",
  "Not Started": "#FB7185",
  Manufacturing: "#38BDF8",
  Delivered: "#2DD4BF",
  Cancelled: "#EF4444",
};

const PAYMENT_PERIODS: Record<FrpPeriodUnit, number[]> = {
  DAYS: [7, 14, 30],
  MONTHS: [1, 3, 6],
};

function paymentPeriodLabel(period: number, unit: FrpPeriodUnit): string {
  if (unit === "DAYS") {
    return period === 1 ? "Last 1 day" : `Last ${period} days`;
  }
  return period === 1 ? "Last 1 month" : `Last ${period} months`;
}

type Period = "1m" | "3m" | "6m";
const PERIOD_MONTHS: Record<Period, number> = { "1m": 1, "3m": 3, "6m": 6 };
const PERIOD_LABEL: Record<Period, string> = {
  "1m": "Last 1 month",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
};
const QUOTIENT_COLORS: Record<string, string> = {
  sent: "#3B82F6",
  viewed: "#0EA5E9",
  question: "#8B5CF6",
  accepted: "#F59E0B",
  declined: "#EF4444",
  completed: "#10B981",
  unknown: "#94A3B8",
};

const EVENT_TYPE_FILL: Record<string, string> = {
  quote_sent: QUOTIENT_COLORS.sent,
  customer_viewed: QUOTIENT_COLORS.viewed,
  customer_question: QUOTIENT_COLORS.question,
  quote_accepted: QUOTIENT_COLORS.accepted,
  quote_declined: QUOTIENT_COLORS.declined,
  quote_completed: QUOTIENT_COLORS.completed,
}

export function CrmPage({ company }: { company: string }) {
  // Paged through in full — see lib/crm/fetch-all-jobs.ts for why this
  // can't reuse JobsContext's single, 200-row-capped page: a customer whose
  // jobs are older than the 200 most recent would otherwise be under-counted.
  const { user } = useAuth();
  const currency = user?.organization?.currency;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [overview, setOverview] = useState<FrpCrmOverviewDTO | null>(null);
  const [pipeline, setPipeline] = useState<FrpCrmJobPipelineDTO | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setJobsLoading(true);
    setJobsError(null);
    fetchAllJobs()
      .then((list) => {
        if (!cancelled) setJobs(list);
      })
      .catch((e) => {
        if (!cancelled) {
          setJobs([]);
          setJobsError(e instanceof Error ? e.message : "Could not load jobs");
        }
      })
      .finally(() => {
        if (!cancelled) setJobsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setOverviewLoading(true);
    setOverviewError(null);
    Promise.all([getCrmOverview(company), getCrmJobPipeline(company)])
      .then(([nextOverview, nextPipeline]) => {
        if (!cancelled) {
          setOverview(nextOverview);
          setPipeline(nextPipeline);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setOverview(null);
          setPipeline(null);
          setOverviewError(
            e instanceof Error ? e.message : "Could not load customer overview"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  const [quotesPage, setQuotesPage] = useState<PageResponse<
    Record<string, unknown>
  > | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("3m");
  const [eventCounts, setEventCounts] = useState<{
    total: number;
    byType: { eventType: string; label: string; count: number }[];
  } | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  // All-time (no `months`), unlike `eventCounts` which is scoped to the
  // period dropdown — the top "Overview" cards show all-time totals.
  const [allTimeEventCounts, setAllTimeEventCounts] = useState<{
    total: number;
    byType: { eventType: string; label: string; count: number }[];
  } | null>(null);
  const [allTimeEventsLoading, setAllTimeEventsLoading] = useState(false);
  const [questionPreviews, setQuestionPreviews] = useState<FrpCrmQuestionDTO[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<FrpJobPaymentHistoryDTO | null>(null);
  const [paymentUnit, setPaymentUnit] = useState<FrpPeriodUnit>("MONTHS");
  const [paymentPeriod, setPaymentPeriod] = useState(6);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    getJobPaymentHistory({
      companyName: company,
      period: paymentPeriod,
      unit: paymentUnit,
    })
      .then((dto) => {
        if (!cancelled) setPaymentHistory(dto);
      })
      .catch(() => {
        if (!cancelled) setPaymentHistory(null);
      });
    return () => {
      cancelled = true;
    };
  }, [company, paymentPeriod, paymentUnit]);

  const companyJobs = useMemo(
    () => jobs.filter((job) => job.clientName === company),
    [jobs, company]
  );

  const fmtMoney = (amount: number) => formatMoney(amount, currency);

  const totalJobs = overview?.totalJobs ?? 0;
  const completedJobs = overview?.completedJobs ?? 0;
  const activeJobs = overview?.activeJobs ?? 0;
  const overdueJobs = overview?.overdueJobs ?? 0;
  const quotesTotalOverview = allTimeEventCounts?.total ?? 0;
  const quotesAcceptedOverview =
    allTimeEventCounts?.byType.find((row) => row.eventType === "quote_accepted")
      ?.count ?? 0;
  const paymentsReceived = fromCents(overview?.totalPaymentReceivedAmount);
  const paymentsOutstanding = fromCents(overview?.outstandingAmount);

  const statusChartData = useMemo(
    () =>
      (pipeline?.byStage ?? []).map((slice) => ({
        status: slice.label,
        count: slice.count,
        fill: JOB_STAGE_COLORS[slice.label] ?? "#94A3B8",
      })),
    [pipeline]
  );

  const jobTotalsData = useMemo(
    () => [
      {
        name: "Active jobs",
        value: pipeline?.activeJobs ?? activeJobs,
        fill: STATUS_THEME.manufacturing.strong,
      },
      {
        name: "Completed jobs",
        value: pipeline?.completedJobs ?? completedJobs,
        fill: STATUS_THEME.delivered.strong,
      },
      {
        name: "Cancelled jobs",
        value: pipeline?.cancelledJobs ?? 0,
        fill: JOB_STAGE_COLORS.Cancelled,
      },
      {
        name: "Total jobs",
        value: pipeline?.totalJobs ?? totalJobs,
        fill: "#F97316",
      },
    ],
    [pipeline, activeJobs, completedJobs, totalJobs]
  );

  const recentJobs = useMemo(
    () =>
      [...companyJobs]
        .sort((a, b) =>
          (b.createdAt ?? b.date ?? "").localeCompare(a.createdAt ?? a.date ?? "")
        )
        .slice(0, 10),
    [companyJobs]
  );

  const clientSince = overview?.clientSince
    ? formatShortDate(overview.clientSince)
    : "—";

  // `GET /quotes` supports a `company` filter (see listQuotes in lib/frp/api.ts).
  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setQuotesLoading(true);
    setQuotesError(null);
    listQuotes(0, 100, { company })
      .then((page) => {
        if (!cancelled) setQuotesPage(page);
      })
      .catch((e) => {
        if (!cancelled) {
          setQuotesPage(null);
          setQuotesError(e instanceof Error ? e.message : "Could not load quotes");
        }
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setEventsLoading(true);
    getQuoteEventCounts({ companyName: company, months: PERIOD_MONTHS[period] })
      .then((dto) => {
        if (!cancelled) setEventCounts(dto);
      })
      .catch(() => {
        if (!cancelled) setEventCounts(null);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company, period]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setAllTimeEventsLoading(true);
    getQuoteEventCounts({ companyName: company })
      .then((dto) => {
        if (!cancelled) setAllTimeEventCounts(dto);
      })
      .catch(() => {
        if (!cancelled) setAllTimeEventCounts(null);
      })
      .finally(() => {
        if (!cancelled) setAllTimeEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  const quoteItems: QuoteListItem[] = useMemo(
    () => (quotesPage?.content ?? []).map(mapQuoteRow),
    [quotesPage]
  );
  const quotesTotal = quotesPage?.totalElements ?? quoteItems.length;

  const recentQuotes = useMemo(
    () =>
      [...quoteItems]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 10),
    [quoteItems]
  );

  // Unset mode matches JobPayment's ACCOUNT default.
  const paymentModeLabel =
    overview?.paymentMode === "CASH" ? "Cash" : "Account";

  const paymentChartData = useMemo(
    () =>
      (paymentHistory?.byMonth ?? []).map((row) => {
        const d = new Date(Date.UTC(row.year, row.month - 1, row.day ?? 1));
        const label =
          row.day != null
            ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
            : d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
        return {
          month: label,
          amount: (row.receivedAmount ?? 0) / 100,
        };
      }),
    [paymentHistory]
  );

  const quoteJourneyData = useMemo(
    () =>
      (eventCounts?.byType ?? []).map((row) => ({
        name: row.label,
        eventType: row.eventType,
        count: row.count,
        fill: EVENT_TYPE_FILL[row.eventType] ?? QUOTIENT_COLORS.unknown,
      })),
    [eventCounts]
  );

  const journeyTotal = eventCounts?.total ?? 0;
  const journeySent =
    eventCounts?.byType.find((row) => row.eventType === "quote_sent")?.count ?? 0;
  const journeyAccepted =
    eventCounts?.byType.find((row) => row.eventType === "quote_accepted")?.count ?? 0;
  const conversionPct =
    journeySent > 0 ? Math.round((journeyAccepted / journeySent) * 100) : null;

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setQuestionsLoading(true);
    getCrmQuestions(company)
      .then((rows) => {
        if (!cancelled) setQuestionPreviews(rows);
      })
      .catch(() => {
        if (!cancelled) setQuestionPreviews([]);
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);

  const handlePaymentUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as FrpPeriodUnit;
    setPaymentUnit(next);
    const options = PAYMENT_PERIODS[next];
    if (!options.includes(paymentPeriod)) {
      setPaymentPeriod(options[options.length - 1]);
    }
  };

  const handlePaymentPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPaymentPeriod(Number(e.target.value));
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(e.target.value as Period);
  };

  return (
    <main className="app-mesh-bg relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="app-mesh-pattern pointer-events-none fixed inset-0 opacity-[0.35]" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/crm"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/40 hover:text-orange-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Customers
          </Link>
        </div>

        {(overviewError || overviewLoading) && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {overviewError ?? "Loading customer overview…"}
          </p>
        )}

        <div className="space-y-6 pb-10">
          <div className="app-card">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-sm font-bold text-orange-700">
                {company.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{company}</p>
                <p className="text-sm text-slate-500">
                  {totalJobs} job{totalJobs === 1 ? "" : "s"} on record
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-6">
                <div className="text-sm text-slate-500">
                  Payment mode
                  <span
                    className={`mt-1 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                      paymentModeLabel === "Cash"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-violet-200 bg-violet-50 text-violet-700"
                    }`}
                  >
                    {paymentModeLabel}
                  </span>
                </div>
                <div className="text-sm text-slate-500">
                  Client since
                  <p className="text-sm font-semibold text-slate-900">{clientSince}</p>
                </div>
              </div>
            </div>
          </div>

          <section aria-label="Key metrics">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Overview</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AnimatedStatTile
                label="Active jobs"
                value={overviewLoading ? "…" : activeJobs}
                hint="Not yet delivered"
              />
              <AnimatedStatTile
                label="Total jobs"
                value={overviewLoading ? "…" : totalJobs}
                hint="All jobs on record"
              />
              <AnimatedStatTile
                label="Total payments"
                value={overviewLoading ? "…" : fmtMoney(paymentsReceived)}
                hint="Received to date"
                accent="delivered"
              />
              <AnimatedStatTile
                label="Outstanding"
                value={overviewLoading ? "…" : fmtMoney(paymentsOutstanding)}
                hint={paymentsOutstanding > 0 ? "Invoiced, not yet paid" : "Fully settled"}
                accent={paymentsOutstanding > 0 ? "amber" : "slate"}
              />
              <AnimatedStatTile
                label="Completed jobs"
                value={overviewLoading ? "…" : completedJobs}
                hint="Delivered to this account"
                accent="delivered"
              />
              <AnimatedStatTile
                label="Overdue"
                value={overviewLoading ? "…" : overdueJobs}
                hint={overdueJobs > 0 ? "Past due date, not complete" : "Nothing overdue"}
                accent={overdueJobs > 0 ? "red" : "slate"}
              />
              <AnimatedStatTile
                label="Total quote events"
                value={allTimeEventsLoading ? "…" : quotesTotalOverview}
                hint="Logged for this account"
              />
              <AnimatedStatTile
                label="Quotes accepted"
                value={allTimeEventsLoading ? "…" : quotesAcceptedOverview}
                hint="Converted into jobs"
                accent="amber"
              />
            </div>
            {quotesError && <p className="mt-2 text-sm text-amber-700">{quotesError}</p>}
          </section>

          <section aria-label="Job pipeline">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Job pipeline</h2>
            <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
              <div className="analytics-chart-card flex min-h-0 flex-col">
                <div className="shrink-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {company} — pipeline by stage
                  </h3>
                  <p className="text-xs text-slate-500">Fabrication lifecycle</p>
                </div>
                <div className="mt-2 min-h-[260px] flex-1">
                  {statusChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="44%"
                          outerRadius="72%"
                          isAnimationActive
                          animationDuration={700}
                        >
                          {statusChartData.map((entry) => (
                            <Cell key={entry.status} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [`${value} jobs`, name]} />
                        <Legend
                          verticalAlign="bottom"
                          height={40}
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11, color: "#475569" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center justify-center text-sm text-slate-500">
                    {overviewLoading
                      ? "Loading pipeline…"
                      : "No jobs on record for this account yet."}
                    </p>
                  )}
                </div>
              </div>

              <div className="analytics-chart-card flex min-h-0 flex-col">
                <div className="shrink-0">
                  <h3 className="text-sm font-semibold text-slate-900">Job totals</h3>
                  <p className="text-xs text-slate-500">
                    Active, completed, cancelled and total jobs for this account
                  </p>
                </div>
                <div className="mt-2 flex min-h-[220px] flex-1 items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={jobTotalsData}
                      layout="vertical"
                      margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                      />
                      <Tooltip formatter={(value: number) => [`${value} jobs`, "Count"]} />
                      <Bar
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive
                        animationDuration={700}
                      >
                        {jobTotalsData.map((row) => (
                          <Cell key={row.name} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Payment history">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-slate-700">
                  <select
                    value={paymentUnit}
                    onChange={handlePaymentUnitChange}
                    className="bg-transparent text-xs font-semibold text-slate-900 outline-none"
                    aria-label="Payment history unit"
                  >
                    <option value="DAYS">Days</option>
                    <option value="MONTHS">Months</option>
                  </select>
                </label>
                <label className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-slate-700">
                  <select
                    value={paymentPeriod}
                    onChange={handlePaymentPeriodChange}
                    className="bg-transparent text-xs font-semibold text-slate-900 outline-none"
                    aria-label="Payment history period"
                  >
                    {PAYMENT_PERIODS[paymentUnit].map((value) => (
                      <option key={`${paymentUnit}-${value}`} value={value}>
                        {paymentPeriodLabel(value, paymentUnit)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="analytics-chart-card">
              <h3 className="text-sm font-semibold text-slate-900">
                {paymentUnit === "DAYS" ? "Daily payments received" : "Monthly payments received"}
              </h3>
              <p className="text-xs text-slate-500">{paymentPeriodLabel(paymentPeriod, paymentUnit)}</p>
              <div className="mt-2 h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={paymentChartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <defs>
                      <linearGradient id="crmPaymentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F97316" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      width={56}
                      tickFormatter={(v: number) => fmtMoney(v)}
                    />
                    <Tooltip
                      formatter={(value: number) => [fmtMoney(value), "Received"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#F97316"
                      strokeWidth={2}
                      fill="url(#crmPaymentFill)"
                      dot={{ r: 3, fill: "#fff", stroke: "#F97316", strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive
                      animationDuration={700}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section aria-label="Quote journey">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Quote journey</h2>
                <p className="mt-1 text-sm text-slate-500">Webhook events for this account&apos;s quotes</p>
              </div>
              <label className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-slate-700">
                <select
                  value={period}
                  onChange={handlePeriodChange}
                  className="bg-transparent text-xs font-semibold text-slate-900 outline-none"
                  aria-label="Time range"
                >
                  <option value="1m">{PERIOD_LABEL["1m"]}</option>
                  <option value="3m">{PERIOD_LABEL["3m"]}</option>
                  <option value="6m">{PERIOD_LABEL["6m"]}</option>
                </select>
              </label>
            </div>
            <div className="app-card">
              <div className="grid gap-3 sm:grid-cols-3">
                <AnimatedStatTile label="Total events" value={journeyTotal} hint={PERIOD_LABEL[period]} />
                <AnimatedStatTile
                  label="Quotes accepted"
                  value={journeyAccepted}
                  hint="Operational jobs triggered"
                  accent="amber"
                />
                <AnimatedStatTile
                  label="Acceptance rate"
                  value={conversionPct != null ? `${conversionPct}%` : "—"}
                  hint={journeySent > 0 ? `From ${journeySent} quotes sent` : "No quotes sent yet"}
                  accent="delivered"
                />
              </div>

              <div className="mt-4 h-56">
                {journeyTotal > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quoteJourneyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: "#64748b" }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700}>
                        {quoteJourneyData.map((row) => (
                          <Cell key={row.name} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">
                    {eventsLoading
                      ? "Loading quote events…"
                      : "No quote events for this account in this period."}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section aria-label="Customer questions">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Customer questions</h2>
            <div className="app-card">
              {questionsLoading ? (
                <p className="text-sm text-slate-500">Loading questions…</p>
              ) : questionPreviews.length > 0 ? (
                <ul className="space-y-2">
                  {questionPreviews.map((q) => (
                    <li key={`${q.quoteNumber}-${q.occurredAt ?? q.text}`}>
                      <Link
                        href={`/quotes/${encodeURIComponent(q.quoteNumber)}`}
                        className="block rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3 transition-colors hover:border-violet-300 hover:bg-violet-50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-violet-700">
                            #{q.quoteNumber} · {q.quoteTitle}
                          </span>
                          <span className="text-xs text-violet-500">
                            {q.occurredAt ? formatShortDate(q.occurredAt) : "—"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-900">&ldquo;{q.text}&rdquo;</p>
                        <p className="mt-1 text-xs text-slate-600">Asked by {q.askedBy}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  No customer questions logged for this account yet.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Recent activity">
            <div className="app-card">
              <h2 className="text-lg font-semibold text-slate-900">Recent jobs</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {recentJobs.length} of {totalJobs}
              </p>
              {recentJobs.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {recentJobs.map((job) => (
                    <li key={job.dbId ?? job.id}>
                      <Link
                        href={`/jobs/${encodeURIComponent(job.id)}`}
                        className="block rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-slate-900">{job.id}</span>
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-600">{job.projectName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatCreatedDate(job.createdAt ?? job.date)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No jobs on record for this account yet.
                </p>
              )}
            </div>

            <div className="app-card">
              <h2 className="text-lg font-semibold text-slate-900">Recent quotes</h2>
              <p className="mt-1 text-sm text-slate-500">
                {quotesLoading ? "Loading…" : `Showing ${recentQuotes.length} of ${quotesTotal}`}
              </p>
              {recentQuotes.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {recentQuotes.map((q) => (
                    <li
                      key={q.quote_number}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/quotes/${encodeURIComponent(q.quote_number)}`}
                          className="truncate font-semibold text-[#F59E0B] hover:underline"
                        >
                          #{q.quote_number}
                        </Link>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                          {q.total_includes_tax != null
                            ? `${q.currency} ${q.total_includes_tax.toLocaleString()}`
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {q.title ?? "Untitled quote"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatShortDate(q.created_at)} · {q.quote_status ?? "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {quotesLoading ? "Loading quotes…" : "No quotes on record for this account yet."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
