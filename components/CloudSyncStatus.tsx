"use client";

export function CloudSyncStatus() {
  return (
    <div
      className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="whitespace-nowrap text-sm font-medium text-slate-600">
        Cloud Sync:{" "}
        <span className="font-semibold text-emerald-700">Online</span>
      </span>
    </div>
  );
}
