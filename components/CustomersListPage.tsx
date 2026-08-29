"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { AnimatedStatTile } from "@/components/analytics/AnimatedStatTile";
import { JobsPagination } from "@/components/JobsPagination";
import {
  getOrganizationCount,
  listClients,
  type FrpJobCompanyCountDTO,
  type FrpOrganizationCountDTO,
} from "@/lib/frp/api";

const CUSTOMERS_PAGE_SIZE = 10;

const TH =
  "sticky top-0 z-10 bg-[#F8FAFC] whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 align-middle";
const TD = "px-3 py-3.5 align-middle text-xs text-slate-700";

type PaymentModeLabel = "Cash" | "Account";

interface CustomerRow {
  name: string;
  activeJobs: number;
  totalJobs: number;
  quotesAccepted: number;
  paymentMode: PaymentModeLabel | null;
  paymentsReceived: number;
}

function PaymentModeBadge({ mode }: { mode: PaymentModeLabel | null }) {
  if (mode == null) {
    return <span className="text-xs font-medium text-slate-400">—</span>;
  }
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

function fromCents(cents: number | undefined): number {
  return (cents ?? 0) / 100;
}

function fmtGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

function initials(name: string): string {
  const parts = name.replace(/&/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function toPaymentModeLabel(mode: FrpJobCompanyCountDTO["paymentMode"]): PaymentModeLabel | null {
  if (mode === "CASH") return "Cash";
  if (mode === "ACCOUNT") return "Account";
  return null;
}

function toCustomerRow(row: FrpJobCompanyCountDTO): CustomerRow {
  return {
    name: row.companyName,
    activeJobs: row.activeJobsCount ?? 0,
    totalJobs: row.jobCount,
    quotesAccepted: row.quoteAcceptedCount ?? 0,
    paymentMode: toPaymentModeLabel(row.paymentMode),
    paymentsReceived: fromCents(row.totalPaymentReceivedAmount),
  };
}

export function CustomersListPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | PaymentModeLabel>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [orgTotals, setOrgTotals] = useState<FrpOrganizationCountDTO | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, modeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const paymentMode =
      modeFilter === "Cash" ? "CASH" : modeFilter === "Account" ? "ACCOUNT" : undefined;
    listClients(page - 1, CUSTOMERS_PAGE_SIZE, {
      search: debouncedSearch || undefined,
      paymentMode,
    })
      .then((result) => {
        if (cancelled) return;
        setCustomers((result.content ?? []).map(toCustomerRow));
        setTotalPages(Math.max(1, result.totalPages ?? 1));
        setTotalItems(result.totalElements ?? 0);
      })
      .catch((e) => {
        if (cancelled) return;
        setCustomers([]);
        setTotalPages(1);
        setTotalItems(0);
        setError(e instanceof Error ? e.message : "Could not load customers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, modeFilter, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    getOrganizationCount()
      .then((totals) => {
        if (!cancelled) setOrgTotals(totals);
      })
      .catch(() => {
        if (!cancelled) setOrgTotals(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleRefresh = () => {
    setReloadToken((t) => t + 1);
  };

  const openCustomer = (name: string) => {
    router.push(`/crm/${encodeURIComponent(name)}`);
  };

  const safePage = Math.min(page, totalPages);
  const emptyMessage =
    totalItems === 0 && !debouncedSearch && modeFilter === "all"
      ? "No jobs on record yet — once jobs are raised, customers will appear here."
      : "No customers match this search / filter.";

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

        {(error || loading) && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error ?? "Loading customers…"}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AnimatedStatTile
            label="Active jobs"
            value={orgTotals?.activeJobsCount ?? 0}
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
              {fmtGBP(fromCents(orgTotals?.totalPaymentReceivedAmount))}
            </p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Cash
                </span>
                <span className="font-semibold text-slate-900">
                  {fmtGBP(fromCents(orgTotals?.cashCollectedPaymentAmount))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  Account
                </span>
                <span className="font-semibold text-slate-900">
                  {fmtGBP(fromCents(orgTotals?.accountCollectedPaymentAmount))}
                </span>
              </div>
            </div>
          </div>
          <AnimatedStatTile
            label="Total jobs"
            value={orgTotals?.jobCount ?? 0}
            hint="All accounts, all time"
          />
          <AnimatedStatTile
            label="Quotes accepted"
            value={orgTotals?.quoteAcceptedCount ?? 0}
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
              onChange={(e) => setModeFilter(e.target.value as "all" | PaymentModeLabel)}
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
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>

        <div className="mt-4 pb-10">
          {customers.length === 0 && !loading ? (
            <p className="app-card text-center text-base font-medium text-slate-600">
              {emptyMessage}
            </p>
          ) : (
            <>
              <div className="flex min-w-0 flex-col gap-3 lg:hidden">
                {customers.map((c) => (
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
                          {c.quotesAccepted}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-slate-500">Payments received</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                          {fmtGBP(c.paymentsReceived)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

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
                      {customers.map((c, index) => (
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
                          <td className={`${TD} text-center tabular-nums`}>{c.quotesAccepted}</td>
                          <td className={`${TD} text-center tabular-nums`}>
                            {fmtGBP(c.paymentsReceived)}
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
                  totalItems={totalItems}
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
