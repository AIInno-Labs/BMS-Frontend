"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { AccessKey } from "@/lib/frp/access";

/**
 * Route guard: renders `children` only once the user is authenticated AND
 * holds `accessKey`. Until then (or if denied) it shows a loading stub and
 * redirects to `fallbackHref` — same shape as the hand-rolled guards in
 * components/admin/*.tsx, but keyed on ACCESS_KEYS (the same map AppNav
 * uses to hide sidebar links) instead of appRole, so a page can't be
 * reached by URL once its sidebar link is hidden.
 *
 * `children` is only mounted after the check passes, so a denied user's
 * browser never runs the wrapped page's own data-fetching effects either.
 */
export function RequireAccess({
  accessKey,
  fallbackHref = "/",
  children,
}: {
  accessKey: AccessKey;
  fallbackHref?: string;
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated, can } = useAuth();
  const router = useRouter();
  const allowed = can(accessKey);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (!allowed) router.replace(fallbackHref);
  }, [loading, isAuthenticated, allowed, router, fallbackHref]);

  if (loading || !isAuthenticated || !allowed) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
