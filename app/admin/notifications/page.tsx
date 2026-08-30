"use client";

import { Suspense } from "react";
import { PlatformNotificationRulesAdminPage } from "@/components/admin/PlatformNotificationRulesAdminPage";

export default function AdminNotificationsRoute() {
  return (
    <Suspense
      fallback={
        <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
          <p className="text-sm text-slate-600">Loading…</p>
        </main>
      }
    >
      <PlatformNotificationRulesAdminPage />
    </Suspense>
  );
}
