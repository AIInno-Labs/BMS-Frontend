"use client";

import { Bell, Search } from "lucide-react";
import { PROFILE_DATA } from "@/constants/administration/profile";

export function AdministrationHeader() {
  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-[#E5E7EB] bg-white px-6 py-3">
      <label className="relative min-w-0 max-w-md flex-1">
        <span className="sr-only">Search system</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search system..."
          className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] py-2 pl-9 pr-3 text-sm text-[#111827] outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
        />
      </label>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-[#111827]">
              {PROFILE_DATA.firstName} {PROFILE_DATA.lastName}
            </p>
            <p className="text-xs text-slate-500">{PROFILE_DATA.role}</p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200" />
        </div>
      </div>
    </header>
  );
}
