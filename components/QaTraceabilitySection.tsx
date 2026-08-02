import { ScanLine, ShieldCheck } from "lucide-react";
import { JobQrCode } from "@/components/JobQrCode";

export function QaTraceabilitySection({ jobId }: { jobId: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:border print:border-slate-300 print:shadow-none sm:p-8">
      <div
        className="print-hide-screen-only pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-100/60 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="print-hide-screen-only mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
            <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden />
            <span className="text-base font-medium text-blue-800">
              Digital Traceability
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            QA &amp; Traceability
          </h2>
          <p className="mt-2 max-w-md text-base text-slate-600">
            Seamless link between office job card and live factory-floor
            updates. Scan at every production gate.
          </p>
        </div>
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-base text-slate-600">
          {jobId}
        </p>
      </div>

      <div className="relative mt-8 grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex justify-center lg:justify-start">
          <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm print:hidden">
            <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <JobQrCode jobId={jobId} size={140} />
            </div>
            <p className="mt-3 text-center text-base font-medium text-slate-600">
              Floor scan code
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50">
              <ScanLine className="h-7 w-7 text-blue-600" aria-hidden />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-900">
                Factory Floor Scan-to-Update
              </p>
              <p className="mt-1 text-base text-slate-600">
                Lay-up / Cure / Dispatch
              </p>
            </div>
          </div>
          <p className="text-base leading-relaxed text-slate-600">
            Operators scan at each station to update completion status,
            replacing paper traveler sign-off sheets with an immutable digital
            audit trail.
          </p>
        </div>
      </div>
    </section>
  );
}
