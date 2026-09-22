import { Suspense } from "react";
import { QuotesPage } from "@/components/QuotesPage";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";
import { LoadingState } from "@/components/ui/Loading";

export default function QuotesRoutePage() {
  return (
    <RequireAccess accessKey={ACCESS_KEYS.QUOTES_VIEW}>
      <Suspense
        fallback={
          <main className="app-mesh-bg flex min-h-screen items-center justify-center px-4 py-6">
            <LoadingState />
          </main>
        }
      >
        <QuotesPage />
      </Suspense>
    </RequireAccess>
  );
}
