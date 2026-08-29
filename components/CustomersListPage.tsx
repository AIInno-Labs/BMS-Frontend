"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { AnimatedStatTile } from "@/components/analytics/AnimatedStatTile";
import { JobsPagination } from "@/components/JobsPagination";
import { listQuotes } from "@/lib/frp/api";
import { mapQuoteRow } from "@/lib/quotient/map-quote-row";
import { estimatePaymentMode, estimatePayments } from "@/lib/crm/demo-payments";
import { fetchAllJobs } from "@/lib/crm/fetch-all-jobs";
import type { Job } from "@/lib/types";

const CUSTOMERS_PAGE_SIZE = 10;

const TH =
  "sticky top-0 z-10 bg-[#F8FAFC] whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 align-middle";
const TD = "px-3 py-3.5 align-middle text-xs text-slate-700";

interface CustomerRow {
  name: string;
  activeJobs: number;
  totalJobs: number;
  quotesAccepted: number;
  paymentMode: "Cash" | "Account";
  paymentsReceived: number;
}

function PaymentModeBadge({ mode }: { mode: "Cash" | "Account" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
        mode === "Cash"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-violet-200 bg-violet-50 text-violet-700"
      }`}
    >
      {mode}
    </span>
  );
}

function isActiveJob(job: Job): boolean {
  return job.status !== "Complete" && job.status !== "Cancelled";
}

function fmtGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

function initials(name: string): string {
  const parts = name.replace(/&/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function CustomersListPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "Cash" | "Account">("all");
  const [page, setPage] = useState(1);
  const [quoteStats, setQuoteStats] = useState<
    Record<string, { accepted: number; acceptedValue: number }>
  >({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  // Bumped by the Refresh button to force both effects below to re-run.
  const [reloadToken, setReloadToken] = useState(0);

  // Paged through in full — see fetch-all-jobs.ts for why this can't reuse
  // JobsContext's single, 200-row-capped page.
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
  }, [reloadToken]);

  const companyNames = useMemo(() => {
    const set = new Set<string>();
    for (const job of jobs) {
      const name = job.clientName?.trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  // Real per-customer accepted-quote counts/values — GET /quotes?company= already
  // supports filtering by company (see listQuotes in lib/frp/api.ts), so this
  // fetches every customer's quotes in parallel rather than estimating.
  useEffect(() => {
    if (companyNames.length === 0) return;
    let cancelled = false;
    setQuotesLoading(true);
    Promise.all(
      companyNames.map(async (name) => {
        try {
          const page = await listQuotes(0, 100, { company: name });
          const items = (page.content ?? []).map(mapQuoteRow);
          const accepted = items.filter((q) => q.quote_status === "ACCEPTED");
          const acceptedValue = accepted.reduce(
            (sum, q) => sum + (q.total_includes_tax ?? 0),
            0
          );
          return [name, { accepted: accepted.length, acceptedValue }] as const;
        } catch {
          return [name, { accepted: 0, acceptedValue: 0 }] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setQuoteStats(Object.fromEntries(entries));
      setQuotesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [companyNames, reloadToken]);

  const refreshing = jobsLoading || quotesLoading;
  const handleRefresh = () => {
    setReloadToken((t) => t + 1);
  };

  const customers: CustomerRow[] = useMemo(() => {
    return companyNames.map((name) => {
      const companyJobs = jobs.filter((j) => j.clientName === name);
      const stats = quoteStats[name] ?? { accepted: 0, acceptedValue: 0 };
      return {
        name,
        activeJobs: companyJobs.filter(isActiveJob).length,
        totalJobs: companyJobs.length,
        quotesAccepted: stats.accepted,
        // TODO(api): payment mode and figures are placeholders — see lib/crm/demo-payments.ts.
        paymentMode: estimatePaymentMode(name),
        paymentsReceived: estimatePayments(stats.acceptedValue).received,
      };
    });
  }, [companyNames, jobs, quoteStats]);

  const orgTotals = useMemo(
    () =>
      customers.reduce(
        (acc, c) => {
          acc.activeJobs += c.activeJobs;
          acc.totalJobs += c.totalJobs;
          acc.quotesAccepted += c.quotesAccepted;
          if (c.paymentMode === "Cash") acc.cashTotal += c.paymentsReceived;
          else acc.accountTotal += c.paymentsReceived;
          return acc;
        },
        { activeJobs: 0, totalJobs: 0, quotesAccepted: 0, cashTotal: 0, accountTotal: 0 }
      ),
    [customers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (modeFilter !== "all" && c.paymentMode !== modeFilter) return false;
      return true;
    });
  }, [customers, search, modeFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, modeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOMERS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedCustomers = filtered.slice(
    (safePage - 1) * CUSTOMERS_PAGE_SIZE,
    safePage * CUSTOMERS_PAGE_SIZE
  );

  const openCustomer = (name: string) => {
    router.push(`/crm/${encodeURIComponent(name)}`);
  };

  return (
    <main className="app-mesh-bg relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="app-mesh-pattern pointer-events-none fixed inset-0 opacity-[0.35]" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-4">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            Customers
          </h1>
          <p className="text-sm text-slate-500">All accounts</p>
        </div>

        {(jobsError || jobsLoading) && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {jobsError ?? "Loading job data…"}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AnimatedStatTile
            label="Active jobs"
            value={orgTotals.activeJobs}
            hint="Across all accounts"
          />
          <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payments received
              </p>
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900">
              {fmtGBP(orgTotals.cashTotal + orgTotals.accountTotal)}
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Cash
                </span>
                <span className="font-semibold text-slate-900">{fmtGBP(orgTotals.cashTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  Account
                </span>
                <span className="font-semibold text-slate-900">
                  {fmtGBP(orgTotals.accountTotal)}
                </span>
              </div>
            </div>
          </div>
          <AnimatedStatTile
            label="Total jobs"
            value={orgTotals.totalJobs}
            hint="All accounts, all time"
          />
          <AnimatedStatTile
            label="Quotes accepted"
            value={orgTotals.quotesAccepted}
            hint="Converted into jobs"
            accent="amber"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 shadow-sm focus-within:border-orange-300/45 focus-within:ring-2 focus-within:ring-orange-200/40">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company name…"
              aria-label="Search customers"
              className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <label className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 shadow-sm">
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as "all" | "Cash" | "Account")}
              aria-label="Filter by payment mode"
              className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
            >
              <option value="all">All modes</option>
              <option value="Cash">Cash mode</option>
              <option value="Account">Account mode</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/40 hover:text-orange-700"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>

        <div className="mt-4 pb-10">
          {filtered.length === 0 && !jobsLoading ? (
            <p className="app-card text-center text-base font-medium text-slate-600">
              {customers.length === 0
                ? "No jobs on record yet — once jobs are raised, customers will appear here."
                : "No customers match this search / filter."}
            </p>
          ) : (
            <>
              {/* Mobile: stacked cards, same pattern as JobsCards in JobsList.tsx */}
              <div className="flex min-w-0 flex-col gap-3 lg:hidden">
                {pagedCustomers.map((c) => (
                  <article
                    key={c.name}
                    role="link"
                    tabIndex={0}
                    onClick={() => openCustomer(c.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCustomer(c.name);
                      }
                    }}
                    className="cursor-pointer rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm transition-colors hover:bg-orange-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold tracking-tight text-slate-900">
                          {c.name}
                        </p>
                      </div>
                      <span className="shrink-0">
                        <PaymentModeBadge mode={c.paymentMode} />
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Active jobs</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {c.activeJobs}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Total jobs</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {c.totalJobs}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Quotes accepted</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {quotesLoading ? "…" : c.quotesAccepted}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Payments received</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {quotesLoading ? "…" : fmtGBP(c.paymentsReceived)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              {/* Desktop: table, same pattern as JobsTable in JobsList.tsx */}
              <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)] lg:block">
                <div className="overflow-auto">
                  <table className="w-full min-w-[760px] table-fixed border-collapse">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
                        <th className={`${TH} text-left`}>Customer</th>
                        <th className={`${TH} text-left`}>Payment mode</th>
                        <th className={`${TH} text-center`}>Active jobs</th>
                        <th className={`${TH} text-center`}>Total jobs</th>
                        <th className={`${TH} text-center`}>Quotes accepted</th>
                        <th className={`${TH} text-center`}>Payments received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCustomers.map((c, index) => (
                        <tr
                          key={c.name}
                          role="link"
                          tabIndex={0}
                          onClick={() => openCustomer(c.name)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openCustomer(c.name);
                            }
                          }}
                          className={`cursor-pointer border-b border-[#E5E7EB] transition-colors duration-200 ease-in-out hover:bg-orange-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60 focus-visible:ring-inset ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          }`}
                        >
                          <td className={`${TD} text-left`}>
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-[11px] font-bold text-orange-700">
                                {initials(c.name)}
                              </span>
                              <p className="truncate font-medium text-slate-900">{c.name}</p>
                            </div>
                          </td>
                          <td className={`${TD} text-left`}>
                            <PaymentModeBadge mode={c.paymentMode} />
                          </td>
                          <td className={`${TD} text-center tabular-nums`}>{c.activeJobs}</td>
                          <td className={`${TD} text-center tabular-nums`}>{c.totalJobs}</td>
                          <td className={`${TD} text-center tabular-nums`}>
                            {quotesLoading ? "…" : c.quotesAccepted}
                          </td>
                          <td className={`${TD} text-center tabular-nums`}>
                            {quotesLoading ? "…" : fmtGBP(c.paymentsReceived)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4">
                <JobsPagination
                  page={safePage}
                  totalPages={totalPages}
                  pageSize={CUSTOMERS_PAGE_SIZE}
                  totalItems={filtered.length}
                  onPageChange={(next) => {
                    setPage(next);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
