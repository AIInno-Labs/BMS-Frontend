"use client";

import { Suspense } from "react";
import { JobsList } from "@/components/JobsList";
import { useJobs } from "@/context/JobsContext";
import { usePersona } from "@/context/PersonaContext";

export function JobsPageContent() {
  const { jobs } = useJobs();
  const { isWorker } = usePersona();
  const showAdvancedERP = false;

  return (
    <main
      className={`min-h-screen overflow-x-hidden bg-slate-50 ${isWorker ? "worker-ui" : ""}`}
    >
      <div className="hidden" />

      <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        <section className="min-w-0">
          <Suspense
            fallback={
              <p className="py-8 text-center text-sm text-slate-500">Loading jobs…</p>
            }
          >
            <JobsList jobs={jobs} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
