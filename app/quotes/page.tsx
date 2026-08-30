import { Suspense } from "react";
import { QuotesPage } from "@/components/QuotesPage";

export default function QuotesRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="app-mesh-bg min-h-screen px-4 py-6">
          <p className="text-sm text-slate-500">Loading quotes…</p>
        </main>
      }
    >
      <QuotesPage />
    </Suspense>
  );
}
