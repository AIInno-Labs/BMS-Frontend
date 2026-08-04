import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Cog } from "lucide-react";
import { useJobs } from "@/context/JobsContext";

const cardBase = "min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm";

function KpiLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </p>
  );
}

function KpiValue({ children }: { children: React.ReactNode }) {
  return <p className="text-2xl font-semibold leading-none tracking-tight text-slate-900">{children}</p>;
}

export function DashboardKpiCards() {
  // Org-wide aggregates from GET /jobs/counts. Counting the loaded `jobs`
  // array instead only counted the first page, so every tile under-reported
  // once a tenant had more jobs than the list fetches.
  const { counts } = useJobs();
  const {
    active: activeJobs,
    manufacturing,
    delivered,
    overdue,
  } = counts;

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
      <article className={cardBase}>
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-red-50 text-red-600">
            <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Today
          </span>
        </div>
        <div className="mt-1.5">
          <KpiLabel>ACTIVE JOBS</KpiLabel>
          <KpiValue>{activeJobs}</KpiValue>
        </div>
      </article>

      <article className={cardBase}>
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <Cog className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Today
          </span>
        </div>
        <div className="mt-1.5">
          <KpiLabel>MANUFACTURING</KpiLabel>
          <KpiValue>{manufacturing}</KpiValue>
        </div>
      </article>

      <article className={cardBase}>
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Today
          </span>
        </div>
        <div className="mt-1.5">
          <KpiLabel>DELIVERED</KpiLabel>
          <KpiValue>{delivered}</KpiValue>
        </div>
      </article>

      <article className={cardBase}>
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-red-50 text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Today
          </span>
        </div>
        <div className="mt-1.5">
          <KpiLabel>OVERDUE</KpiLabel>
          <KpiValue>{overdue}</KpiValue>
        </div>
      </article>
    </div>
  );
}
