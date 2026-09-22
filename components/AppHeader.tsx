"use client";

import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppProfileMenu } from "@/components/AppProfileMenu";
import { NotificationPanel } from "@/components/NotificationPanel";
import { PageSearchBox } from "@/components/PageSearchBox";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import { ACCESS_KEYS } from "@/lib/frp/access";
import { MIN_JOB_SEARCH_LENGTH } from "@/lib/jobListUtils";

type Router = ReturnType<typeof useRouter>;

type SearchCommitContext = {
  router: Router;
  searchParams: URLSearchParams;
};

/** Per-page navbar search config. A route with no `search` block gets no
 *  search box — add one here to turn search on for a new page later. */
type SearchConfig = {
  placeholder: string;
  srLabel: string;
  /** Value to prefill the box with, read from the current URL. */
  value: (searchParams: URLSearchParams) => string;
  commit: (trimmed: string, ctx: SearchCommitContext) => void;
  /** Below this many characters, typing doesn't commit (see PageSearchBox). */
  minLength?: number;
};

type RouteConfig = {
  match: (pathname: string) => boolean;
  title: string;
  search?: SearchConfig;
};

/** Shared by /jobs and /quotes: both write `?q=` (and drop `?page=`) onto
 *  their own URL via router.replace, so typing doesn't add history entries. */
function listPageSearch(basePath: "/jobs" | "/quotes"): Pick<SearchConfig, "value" | "commit"> {
  return {
    value: (searchParams) => searchParams.get("q") ?? "",
    commit: (trimmed, { router, searchParams }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
  };
}

const ROUTES: RouteConfig[] = [
  {
    match: (p) => p === "/",
    title: "Dashboard",
    search: {
      placeholder: "Search by job or customer...",
      srLabel: "Search jobs",
      minLength: MIN_JOB_SEARCH_LENGTH,
      // Dashboard has no jobs list of its own — hand off to /jobs.
      value: () => "",
      commit: (trimmed, { router }) => {
        if (trimmed) router.push(`/jobs?q=${encodeURIComponent(trimmed)}`);
      },
    },
  },
  { match: (p) => p.startsWith("/jobs/"), title: "Job Card" },
  {
    match: (p) => p === "/jobs",
    title: "Jobs",
    search: {
      placeholder: "Search by job or customer...",
      srLabel: "Search jobs",
      minLength: MIN_JOB_SEARCH_LENGTH,
      ...listPageSearch("/jobs"),
    },
  },
  { match: (p) => p.startsWith("/quotes/"), title: "Quote Detail" },
  {
    match: (p) => p === "/quotes",
    title: "Quotes",
    search: {
      placeholder: "Search by quote, company, or title...",
      srLabel: "Search quotes",
      ...listPageSearch("/quotes"),
    },
  },
  { match: (p) => p.startsWith("/analytics"), title: "Analytics" },
  { match: (p) => p === "/admin", title: "Super Admin" },
  { match: (p) => p.startsWith("/admin/organizations"), title: "Organizations" },
  { match: (p) => p.startsWith("/admin/privileges"), title: "Privileges" },
  { match: (p) => p.startsWith("/admin/parameters"), title: "Parameters" },
  { match: (p) => p.startsWith("/admin/notifications"), title: "Notifications" },
  { match: (p) => p === "/org", title: "Org Admin" },
  { match: (p) => p.startsWith("/org/roles"), title: "Roles" },
  { match: (p) => p.startsWith("/org/notifications"), title: "Notifications" },
  { match: (p) => p === "/login", title: "Sign in" },
];

const DEFAULT_ROUTE: RouteConfig = { match: () => true, title: "Dashboard" };

function resolveRoute(pathname: string): RouteConfig {
  return ROUTES.find((r) => r.match(pathname)) ?? DEFAULT_ROUTE;
}

export function AppHeader({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const route = resolveRoute(pathname);
  const searchConfig = route.search;

  const { can } = useAuth();
  const notifications = useNotifications();
  const [panelOpen, setPanelOpen] = useState(false);
  const unreadCount = notifications?.unreadCount ?? 0;
  const canViewNotifications = can(ACCESS_KEYS.NOTIFICATIONS_VIEW);

  const handleCommit = (trimmed: string) => {
    searchConfig?.commit(trimmed, { router, searchParams });
  };

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
          {route.title}
        </h1>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          {searchConfig ? (
            <PageSearchBox
              value={searchConfig.value(searchParams)}
              onCommit={handleCommit}
              placeholder={searchConfig.placeholder}
              srLabel={searchConfig.srLabel}
              minLength={searchConfig.minLength}
              className="hidden max-w-md flex-1 sm:block"
            />
          ) : null}
          {canViewNotifications ? (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPanelOpen((open) => !open)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
                aria-label={
                  unreadCount > 0
                    ? `Notifications (${unreadCount} unread)`
                    : "Notifications"
                }
                aria-expanded={panelOpen}
                aria-haspopup="dialog"
              >
                <Bell className="h-4 w-4" aria-hidden />
                {unreadCount > 0 ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.05rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white"
                    aria-hidden
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {panelOpen ? (
                <NotificationPanel onClose={() => setPanelOpen(false)} />
              ) : null}
            </div>
          ) : null}
          <AppProfileMenu />
        </div>
      </div>

      {searchConfig ? (
        <PageSearchBox
          value={searchConfig.value(searchParams)}
          onCommit={handleCommit}
          placeholder={searchConfig.placeholder}
          srLabel={searchConfig.srLabel}
          minLength={searchConfig.minLength}
          className="mt-2 block sm:hidden"
        />
      ) : null}
    </header>
  );
}
