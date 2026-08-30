"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FrpLogo } from "@/components/FrpLogo";
import { AppNav } from "@/components/AppNav";
import { useAuth } from "@/context/AuthContext";
import { JobsProvider } from "@/context/JobsContext";
import { PersonaProvider } from "@/context/PersonaContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { Suspense } from "react";

function AuthLoadingStub() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-600">Loading…</p>
    </div>
  );
}

/**
 * The authenticated app shell (sidebar, header, jobs/persona context) — split
 * out of Providers.tsx and lazy-loaded there. /login never renders this, but
 * a static import would still force its whole bundle (nav, header, job
 * context and everything they pull in) to be fetched and parsed before the
 * login form can hydrate, widening the window where a click lands before
 * React's onSubmit is attached and falls through to a native form reload.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  if (loading || !isAuthenticated) {
    return <AuthLoadingStub />;
  }

  return (
    // NotificationProvider sits inside the authenticated shell, not in
    // Providers.tsx: it polls on a timer, and /login must not.
    <NotificationProvider>
      <JobsProvider>
        <PersonaProvider>
        <div className="flex min-h-dvh min-w-0 overflow-x-clip bg-slate-50 print:min-h-0 print:overflow-visible">
          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white print:hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col">
            <div className="border-b border-slate-100 px-2.5 py-2.5">
              <Link href="/" className="block w-full">
                <FrpLogo variant="lockup" size="sidebar" />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <AppNav />
            </div>
          </aside>

          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/30"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close navigation overlay"
              />
              <div className="relative h-full w-[min(100%,18rem)] max-w-[85vw] border-r border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                  <Link
                    href="/"
                    className="block min-w-0 flex-1 pr-2"
                    onClick={() => setMobileSidebarOpen(false)}
                  >
                    <FrpLogo variant="lockup" size="sidebar" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
                    aria-label="Close navigation"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div
                  className="px-3 py-3"
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <AppNav />
                </div>
              </div>
            </div>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col print:min-h-0 print:overflow-visible lg:ml-64">
            <Suspense
              fallback={
                <header className="sticky top-0 z-40 h-[52px] shrink-0 border-b border-[#E5E7EB] bg-white/95 print:hidden" />
              }
            >
              <AppHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />
            </Suspense>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start">
              {children}
            </div>
          </div>
        </div>
        </PersonaProvider>
      </JobsProvider>
    </NotificationProvider>
  );
}

export default AuthShell;
