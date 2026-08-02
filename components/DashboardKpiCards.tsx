import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Cog } from "lucide-react";
import { useJobs } from "@/context/JobsContext";
import type { Job } from "@/lib/types";

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

function isActiveJob(job: Job): boolean {
  return job.status !== "Complete" && job.status !== "Cancelled";
}

export function DashboardKpiCards() {
  const { jobs } = useJobs();
  const activeJobs = jobs.filter((j) => isActiveJob(j)).length;
  const manufacturing = jobs.filter((j) => j.status === "In Fabrication").length;
  const delivered = jobs.filter((j) => j.status === "Complete").length;
  const now = Date.now();
  const overdue = jobs.filter((j) => {
    if (!isActiveJob(j) || !j.dueDate) return false;
    const due = new Date(j.dueDate).getTime();
    return Number.isFinite(due) && due < now;
  }).length;

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
