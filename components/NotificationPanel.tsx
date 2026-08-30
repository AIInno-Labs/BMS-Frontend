"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AtSign, CheckCheck, Loader2 } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import type { NotificationDTO } from "@/lib/frp/types";

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notifications = useNotifications();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const loadItems = notifications?.loadItems;

  useEffect(() => {
    void loadItems?.();
  }, [loadItems]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    // Deferred a tick: the click that opened the panel is still propagating,
    // and would otherwise immediately close it again.
    const id = setTimeout(
      () => document.addEventListener("mousedown", onPointerDown),
      0
    );
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(id);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [onClose]);

  const handleOpen = useCallback(
    async (n: NotificationDTO) => {
      if (!n.readAt) await notifications?.markRead([n.id]);
      onClose();
      if (n.jobNumber) {
        router.push(`/jobs/${encodeURIComponent(n.jobNumber)}?openChat=1`);
      }
    },
    [notifications, onClose, router]
  );

  const items = notifications?.items ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#111827]">Notifications</h2>
        {hasUnread ? (
          <button
            type="button"
            onClick={() => void notifications?.markAllRead()}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-orange-700"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Mark all read
          </button>
        ) : null}
      </header>

      <div className="max-h-[24rem] overflow-y-auto overscroll-contain">
        {notifications?.loadingItems && items.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">
            Nothing yet. You’ll be notified when someone posts{" "}
            <span className="font-semibold text-slate-500">@all</span> on a job.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void handleOpen(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    n.readAt ? "" : "bg-orange-50/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      n.readAt
                        ? "bg-slate-100 text-slate-400"
                        : "bg-orange-100 text-orange-700"
                    }`}
                    aria-hidden
                  >
                    <AtSign className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-xs ${
                          n.readAt
                            ? "font-medium text-slate-600"
                            : "font-semibold text-[#111827]"
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                    {n.bodyPreview ? (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
                        {n.bodyPreview}
                      </span>
                    ) : null}
                  </span>
                  {n.readAt ? null : (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500"
                      aria-label="Unread"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
