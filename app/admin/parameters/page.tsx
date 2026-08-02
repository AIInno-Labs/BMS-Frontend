"use client";

import { Suspense } from "react";
import { ParametersAdminPage } from "@/components/admin/ParametersAdminPage";

export default function AdminParametersRoute() {
  return (
    <Suspense
      fallback={
        <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-slate-600">Loading…</p>
        </main>
      }
    >
      <ParametersAdminPage />
    </Suspense>
  );
}
