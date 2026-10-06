"use client";

import { Suspense } from "react";
import { ParametersAdminPage } from "@/components/admin/ParametersAdminPage";
import { LoadingState } from "@/components/ui/Loading";

export default function AdminParametersRoute() {
  return (
    <Suspense
      fallback={
        <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
          <LoadingState />
        </main>
      }
    >
      <ParametersAdminPage />
    </Suspense>
  );
}
