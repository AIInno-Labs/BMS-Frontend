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
import { jobStageLabel, JOB_STAGE_LABEL_ORDER } from "@/lib/crm/job-stage-label";
import { formatCreatedDate, formatShortDate } from "@/lib/jobData";
import { getQuote, listQuotes } from "@/lib/frp/api";
import { mapQuoteRow } from "@/lib/quotient/map-quote-row";
import { extractQuoteQuestions } from "@/lib/quotient/extract-questions";
import { formatQuotientContact } from "@/lib/quotient/formatContact";
import type { QuoteListItem } from "@/lib/quotient/quote-types";
import type { PageResponse } from "@/lib/frp/types";
import { STATUS_THEME } from "@/lib/statusColors";
import { estimatePaymentMode, estimatePayments } from "@/lib/crm/demo-payments";
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

type Period = "1m" | "3m" | "6m";
const PERIOD_MONTHS: Record<Period, number> = { "1m": 1, "3m": 3, "6m": 6 };
const PERIOD_LABEL: Record<Period, string> = {
  "1m": "Last 1 month",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
};

const QUOTIENT_LABELS: Record<string, string> = {
  sent: "Quote sent",
  viewed: "Customer viewed",
  question: "Customer question",
  accepted: "Quote accepted",
  declined: "Quote declined",
  completed: "Quote completed",
  unknown: "Unknown",
};

// One distinct color per event type — was reusing STATUS_THEME's 3 status
// hues across all 7 bars, which made several of them indistinguishable.
const QUOTIENT_COLORS: Record<string, string> = {
  sent: "#3B82F6",
  viewed: "#0EA5E9",
  question: "#8B5CF6",
  accepted: "#F59E0B",
  declined: "#EF4444",
  completed: "#10B981",
  unknown: "#94A3B8",
};

function isActiveJob(job: Job): boolean {
  return job.status !== "Complete" && job.status !== "Cancelled";
}

interface QuestionPreview {
  quoteNumber: string;
  quoteTitle: string;
  text: string;
  askedBy: string;
  date: string;
}

export function CrmPage({ company }: { company: string }) {
  // Paged through in full — see lib/crm/fetch-all-jobs.ts for why this
  // can't reuse JobsContext's single, 200-row-capped page: a customer whose
  // jobs are older than the 200 most recent would otherwise be under-counted.
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

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

  const [quotesPage, setQuotesPage] = useState<PageResponse<
    Record<string, unknown>
  > | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("3m");
  const [questionPreviews, setQuestionPreviews] = useState<QuestionPreview[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const companyJobs = useMemo(
    () => jobs.filter((job) => job.clientName === company),
    [jobs, company]
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const totalJobs = companyJobs.length;
  const completedJobs = companyJobs.filter((j) => j.status === "Complete").length;
  const activeJobs = companyJobs.filter(isActiveJob).length;
  const overdueJobs = companyJobs.filter(
    (j) => isActiveJob(j) && j.dueDate && j.dueDate < today
  ).length;

  // Pie slices: the real per-job stage (Draft / Drawing / Approval /
  // Production / QC / Dispatch / Completed) — the same currentStageKey-based
  // label shown as the stage badge on the real Jobs page — not the coarser
  // legacy status. See lib/crm/job-stage-label.ts.
  const statusChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of companyJobs) {
      const label = jobStageLabel(job);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return JOB_STAGE_LABEL_ORDER.filter((label) => counts.has(label)).map((status) => ({
      status,
      count: counts.get(status) as number,
      fill: JOB_STAGE_COLORS[status] ?? "#94A3B8",
    }));
  }, [companyJobs]);

  const jobTotalsData = useMemo(
    () => [
      { name: "Active jobs", value: activeJobs, fill: STATUS_THEME.manufacturing.strong },
      { name: "Completed jobs", value: completedJobs, fill: STATUS_THEME.delivered.strong },
      { name: "Total jobs", value: totalJobs, fill: "#F97316" },
    ],
    [activeJobs, completedJobs, totalJobs]
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

  const clientSince = useMemo(() => {
    let earliest: string | null = null;
    for (const j of companyJobs) {
      const d = j.createdAt ?? j.date;
      if (!d) continue;
      if (!earliest || d < earliest) earliest = d;
    }
    return earliest ? formatShortDate(earliest) : "—";
  }, [companyJobs]);

  // `GET /quotes` supports a `company` filter (see listQuotes in lib/frp/api.ts),
  // so unlike payments and the Quotient journey chart below, this is real backend data.
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

  const quoteItems: QuoteListItem[] = useMemo(
    () => (quotesPage?.content ?? []).map(mapQuoteRow),
    [quotesPage]
  );
  // `totalElements` is the authoritative count from the backend; `quoteItems`
  // itself is capped at the 100-row page fetched above, so `quotesAccepted`
  // is exact up to that cap and a floor beyond it.
  const quotesTotal = quotesPage?.totalElements ?? quoteItems.length;
  const quotesAccepted = quoteItems.filter((q) => q.quote_status === "ACCEPTED").length;
  const acceptedQuotesValue = useMemo(
    () =>
      quoteItems
        .filter((q) => q.quote_status === "ACCEPTED")
        .reduce((sum, q) => sum + (q.total_includes_tax ?? 0), 0),
    [quoteItems]
  );

  const recentQuotes = useMemo(
    () =>
      [...quoteItems]
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
        .slice(0, 10),
    [quoteItems]
  );

  // TODO(api): no payments/invoicing ledger API exists yet, and the one real
  // signal (printDetails.accountYesNo) isn't on the jobs list projection —
  // see lib/crm/demo-payments.ts for the full explanation. `acceptedQuotesValue`
  // above is real; only the received/outstanding split and the monthly
  // breakdown below are estimated from it.
  const paymentMode = useMemo(() => estimatePaymentMode(company), [company]);
  const payments = useMemo(
    () => estimatePayments(acceptedQuotesValue),
    [acceptedQuotesValue]
  );

  const paymentChartData = useMemo(() => {
    const now = new Date();
    return payments.monthlyReceived.map((amount, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: d.toLocaleDateString("en-GB", { month: "short" }), amount };
    });
  }, [payments]);

  // TODO(api): GET /quotes/event-counts (see getQuoteEventCounts in
  // lib/frp/api.ts) is org-wide only today — no `company` or date-range
  // filter, so it can't back a per-customer, per-period chart yet. Until the
  // backend adds one (e.g. GET /quotes/event-counts?company=&months=), this
  // section estimates a plausible event breakdown from the real quote totals
  // above so the chart still reacts to the period picker.
  const quoteJourneyData = useMemo(() => {
    const scale = PERIOD_MONTHS[period] / 6;
    const round = (n: number) => Math.max(0, Math.round(n));
    const declinedPool = Math.max(quotesTotal - quotesAccepted, 0);
    const buckets: Record<string, number> = {
      sent: round(quotesTotal * scale),
      viewed: round(quotesTotal * 0.85 * scale),
      question: round(quotesTotal * 0.4 * scale),
      accepted: round(quotesAccepted * scale),
      declined: round(declinedPool * 0.55 * scale),
      completed: round(quotesAccepted * 0.65 * scale),
      unknown: round(quotesTotal * 0.05 * scale),
    };
    return Object.entries(buckets).map(([key, count]) => ({
      name: QUOTIENT_LABELS[key],
      count,
      fill: QUOTIENT_COLORS[key],
    }));
  }, [quotesTotal, quotesAccepted, period]);

  const journeyTotal = quoteJourneyData.reduce((sum, d) => sum + d.count, 0);
  const journeySent = quoteJourneyData.find((d) => d.name === QUOTIENT_LABELS.sent)?.count ?? 0;
  const journeyAccepted =
    quoteJourneyData.find((d) => d.name === QUOTIENT_LABELS.accepted)?.count ?? 0;
  const conversionPct =
    journeySent > 0 ? Math.round((journeyAccepted / journeySent) * 100) : null;

  // Real: quotes with question_count > 0 are fetched in full (GET /quotes/{quoteNumber})
  // to read their actual question text, then linked straight to the real quote detail
  // page — the same "Customer questions (conversation)" UI QuoteDetailPage.tsx renders.
  useEffect(() => {
    const candidates = [...quoteItems]
      .filter((q) => q.question_count > 0)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 5);

    if (candidates.length === 0) {
      setQuestionPreviews([]);
      return;
    }

    let cancelled = false;
    setQuestionsLoading(true);
    Promise.all(
      candidates.map(async (q) => {
        const raw = await getQuote(q.quote_number).catch(() => null);
        if (!raw) return null;
        const questions = extractQuoteQuestions(raw);
        const latest = questions[questions.length - 1];
        if (!latest) return null;
        return {
          quoteNumber: q.quote_number,
          quoteTitle: q.title ?? "Untitled quote",
          text: latest.question_text,
          askedBy: formatQuotientContact(latest.asked_by) || "Customer",
          date: latest.question_when ?? latest.created_at,
        } satisfies QuestionPreview;
      })
    ).then((results) => {
      if (cancelled) return;
      setQuestionPreviews(results.filter((r): r is QuestionPreview => r !== null));
      setQuestionsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [quoteItems]);

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

        {(jobsError || jobsLoading) && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {jobsError ?? "Loading job data…"}
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
                      paymentMode === "Cash"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-violet-200 bg-violet-50 text-violet-700"
                    }`}
                  >
                    {paymentMode}
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
              <AnimatedStatTile label="Active jobs" value={activeJobs} hint="Not yet delivered" />
              <AnimatedStatTile label="Total jobs" value={totalJobs} hint="All jobs on record" />
              <AnimatedStatTile
                label="Total payments"
                value={`£${payments.received.toLocaleString("en-GB")}`}
                hint="Received to date"
                accent="delivered"
              />
              <AnimatedStatTile
                label="Outstanding"
                value={`£${payments.outstanding.toLocaleString("en-GB")}`}
                hint={payments.outstanding > 0 ? "Invoiced, not yet paid" : "Fully settled"}
                accent={payments.outstanding > 0 ? "amber" : "slate"}
              />
              <AnimatedStatTile
                label="Completed jobs"
                value={completedJobs}
                hint="Delivered to this account"
                accent="delivered"
              />
              <AnimatedStatTile
                label="Overdue"
                value={overdueJobs}
                hint={overdueJobs > 0 ? "Past due date, not complete" : "Nothing overdue"}
                accent={overdueJobs > 0 ? "red" : "slate"}
              />
              <AnimatedStatTile
                label="Total quotes"
                value={quotesLoading ? "…" : quotesTotal}
                hint="Issued to this account"
              />
              <AnimatedStatTile
                label="Quotes accepted"
                value={quotesLoading ? "…" : quotesAccepted}
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
                      No jobs on record for this account yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="analytics-chart-card flex min-h-0 flex-col">
                <div className="shrink-0">
                  <h3 className="text-sm font-semibold text-slate-900">Job totals</h3>
                  <p className="text-xs text-slate-500">
                    Active, completed and total jobs for this account
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
                        width={96}
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
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Payment history</h2>
            <div className="analytics-chart-card">
              <h3 className="text-sm font-semibold text-slate-900">Monthly payments received</h3>
              <p className="text-xs text-slate-500">Last 6 months</p>
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
                      tickFormatter={(v: number) => `£${v.toLocaleString("en-GB")}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`£${value.toLocaleString("en-GB")}`, "Received"]}
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
                    {quotesLoading ? "Loading quotes…" : "No quotes on record for this account yet."}
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
                    <li key={q.quoteNumber}>
                      <Link
                        href={`/quotes/${encodeURIComponent(q.quoteNumber)}`}
                        className="block rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3 transition-colors hover:border-violet-300 hover:bg-violet-50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-violet-700">
                            #{q.quoteNumber} · {q.quoteTitle}
                          </span>
                          <span className="text-xs text-violet-500">
                            {q.date ? formatShortDate(q.date) : "—"}
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
