"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FrpLogo } from "@/components/FrpLogo";
import { AppNav } from "@/components/AppNav";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { JobsProvider } from "@/context/JobsContext";
import { PersonaProvider } from "@/context/PersonaContext";

function AuthLoadingStub() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-600">Loading…</p>
    </div>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return <AuthLoadingStub />;
  }

  return (
    <JobsProvider>
      <PersonaProvider>
        <div className="flex h-dvh min-w-0 overflow-x-hidden bg-slate-50 print:h-auto print:overflow-visible">
          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white print:hidden lg:flex lg:flex-col">
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

          <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden print:h-auto print:overflow-visible">
            <Suspense
              fallback={
                <header className="sticky top-0 z-40 h-[52px] shrink-0 border-b border-[#E5E7EB] bg-white/95 print:hidden" />
              }
            >
              <AppHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />
            </Suspense>
            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 print:overflow-visible">
              {children}
            </main>
          </div>
        </div>
      </PersonaProvider>
    </JobsProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <AuthProvider>
      {isLogin ? children : <AuthShell>{children}</AuthShell>}
    </AuthProvider>
  );
}
