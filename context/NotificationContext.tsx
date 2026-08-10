"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/frp/api";
import { useAuth } from "@/context/AuthContext";
import type { NotificationDTO } from "@/lib/frp/types";

/**
 * How often the badge polls, in ms.
 *
 * 45s is a deliberate choice, not a placeholder. The badge is the only thing
 * every signed-in user requests continuously, so at 25 staff this is ~0.55
 * req/s — and most of those answer 304 because the server ETags the summary.
 * Dropping it to 5s would be 9x the traffic to shave latency nobody notices on
 * a workshop coordination tool.
 */
const BADGE_INTERVAL_MS = 45_000;

/** Backoff ceiling. Reached after ~2 consecutive failures. */
const MAX_INTERVAL_MS = 180_000;

interface NotificationContextValue {
  unreadCount: number;
  items: NotificationDTO[];
  loadingItems: boolean;
  /** Re-poll the badge immediately — call after any action that reads. */
  refresh: () => Promise<void>;
  /** Load the panel list. Called when the panel opens, not on every poll. */
  loadItems: () => Promise<void>;
  markRead: (ids: number[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const intervalRef = useRef(BADGE_INTERVAL_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const pollSummary = useCallback(async () => {
    // A hidden tab is not looking at the bell. Skipping the request entirely
    // means a backgrounded tab costs nothing at all, rather than merely less.
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const summary = await getNotificationSummary();
      if (!mountedRef.current) return;
      setUnreadCount(summary.unreadCount ?? 0);
      intervalRef.current = BADGE_INTERVAL_MS;
    } catch {
      // Back off rather than hammering a backend that is restarting. Silent by
      // design: a failed badge poll is not worth interrupting the user for.
      intervalRef.current = Math.min(intervalRef.current * 2, MAX_INTERVAL_MS);
    }
  }, []);

  // Self-rescheduling timeout rather than setInterval, so the backoff above
  // actually changes the next delay. setInterval would keep firing at the
  // original rate no matter what intervalRef says.
  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated) {
      setUnreadCount(0);
      setItems([]);
      return () => {
        mountedRef.current = false;
      };
    }

    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      timerRef.current = setTimeout(async () => {
        await pollSummary();
        schedule();
      }, intervalRef.current);
    };

    void pollSummary();
    schedule();

    // Coming back to the tab should feel instant, not "up to 45s stale".
    const onVisibility = () => {
      if (!document.hidden) void pollSummary();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, pollSummary]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const page = await listNotifications({ page: 0, size: 20 });
      setItems(page.content ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const markRead = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return;
      const readAt = new Date().toISOString();
      // Applied locally first so the dot goes out on click rather than on the
      // next poll. The server is the authority; the refresh below reconciles.
      setItems((prev) =>
        prev.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
      try {
        await markNotificationsRead({ ids });
      } finally {
        await pollSummary();
      }
    },
    [pollSummary]
  );

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } finally {
      await pollSummary();
    }
  }, [pollSummary]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      items,
      loadingItems,
      refresh: pollSummary,
      loadItems,
      markRead,
      markAllRead,
    }),
    [unreadCount, items, loadingItems, pollSummary, loadItems, markRead, markAllRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Returns null outside the provider rather than throwing, unlike useAuth.
 * The bell renders on every authenticated page but the provider is mounted
 * inside AuthShell, so a component rendered on /login must degrade to "no
 * notifications" instead of crashing the page.
 */
export function useNotifications(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
