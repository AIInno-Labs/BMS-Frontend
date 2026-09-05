"use client";

import { Suspense } from "react";
import { PlatformNotificationRulesAdminPage } from "@/components/admin/PlatformNotificationRulesAdminPage";
import { LoadingState } from "@/components/ui/Loading";

export default function AdminNotificationsRoute() {
  return (
    <Suspense
      fallback={
        <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
          <LoadingState />
        </main>
      }
    >
      <PlatformNotificationRulesAdminPage />
    </Suspense>
  );
}
