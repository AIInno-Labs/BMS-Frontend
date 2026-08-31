import { Suspense } from "react";
import { QuotesPage } from "@/components/QuotesPage";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

export default function QuotesRoutePage() {
  return (
    <RequireAccess accessKey={ACCESS_KEYS.QUOTES_VIEW}>
      <Suspense
        fallback={
          <main className="app-mesh-bg min-h-screen px-4 py-6">
            <p className="text-sm text-slate-500">Loading quotes…</p>
          </main>
        }
      >
        <QuotesPage />
      </Suspense>
    </RequireAccess>
  );
}
