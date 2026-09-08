"use client";

import { Suspense } from "react";
import { JobsList } from "@/components/JobsList";
import { useJobs } from "@/context/JobsContext";
import { usePersona } from "@/context/PersonaContext";
import { LoadingState } from "@/components/ui/Loading";

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
              <div className="flex justify-center py-8">
                <LoadingState />
              </div>
            }
          >
            <JobsList jobs={jobs} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
