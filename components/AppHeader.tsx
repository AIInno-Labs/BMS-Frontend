"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppProfileMenu } from "@/components/AppProfileMenu";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/jobs/")) return "Job Card";
  if (pathname === "/jobs") return "Jobs";
  if (pathname.startsWith("/quotes/")) return "Quote Detail";
  if (pathname === "/quotes") return "Quotes";
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname === "/admin") return "Super Admin";
  if (pathname.startsWith("/admin/organizations")) return "Organizations";
  if (pathname.startsWith("/admin/privileges")) return "Privileges";
  if (pathname === "/org") return "Org Admin";
  if (pathname.startsWith("/org/roles")) return "Roles";
  if (pathname === "/login") return "Sign in";
  return "Dashboard";
}

export function AppHeader({
  onOpenSidebar,
}: {
  onOpenSidebar?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageTitle = getPageTitle(pathname);
  const onJobsList = pathname === "/jobs";
  const urlQuery = searchParams.get("q") ?? "";

  const [draft, setDraft] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(onJobsList ? urlQuery : "");
  }, [onJobsList, urlQuery]);

  const commitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (onJobsList) {
        const params = new URLSearchParams(searchParams.toString());
        if (trimmed) params.set("q", trimmed);
        else params.delete("q");
        const qs = params.toString();
        router.replace(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
        return;
      }
      if (trimmed) {
        router.push(`/jobs?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [onJobsList, router, searchParams]
  );

  const handleSearchChange = (value: string) => {
    setDraft(value);
    if (!onJobsList) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitSearch(value), 250);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-[#E5E7EB] bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-md print:hidden sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </button>

        <h1 className="min-w-0 truncate text-sm font-semibold text-[#111827] sm:text-base">
          {pageTitle}
        </h1>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <label className="relative hidden min-w-0 max-w-md flex-1 sm:block">
            <span className="sr-only">Search jobs</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={draft}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  commitSearch(draft);
                }
              }}
              placeholder="Search by job, customer, or contact..."
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] py-1.5 pl-9 pr-3 text-sm text-[#111827] outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
            />
          </label>
          <button
            type="button"
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
          </button>
          <AppProfileMenu />
        </div>
      </div>

      <label className="relative mt-2 block sm:hidden">
        <span className="sr-only">Search jobs</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={draft}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (debounceRef.current) clearTimeout(debounceRef.current);
              commitSearch(draft);
            }
          }}
          placeholder="Search by job, customer, or contact..."
          className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] py-1.5 pl-9 pr-3 text-sm text-[#111827] outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
        />
      </label>
    </header>
  );
}
