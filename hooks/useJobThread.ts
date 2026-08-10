"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listJobMessages,
  markThreadRead,
  postJobMessage,
} from "@/lib/frp/api";
import { useNotifications } from "@/context/NotificationContext";
import type { GroupChatDTO } from "@/lib/frp/types";

/** Thread poll cadence while the drawer is open and the tab is visible. */
const THREAD_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 60_000;

/** A message that has not been acknowledged by the server yet. */
export interface PendingMessage extends GroupChatDTO {
  pending?: boolean;
  failed?: boolean;
}

function newClientMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Older Safari on workshop tablets. Only needs to be unique per job.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Merge by id, keeping the newest-first order the server returns.
 *
 * Deliberately not an append: `since` is a timestamp, and two app servers with
 * slightly different clocks could return a message the client already holds.
 * Keying on id makes a repeat harmless.
 *
 * Optimistic rows are matched on `clientMsgId` so the server's copy replaces
 * the pending bubble rather than appearing beside it.
 */
function mergeMessages(
  prev: PendingMessage[],
  incoming: GroupChatDTO[]
): PendingMessage[] {
  const byId = new Map<number, PendingMessage>();
  const pendingByClientId = new Map<string, PendingMessage>();

  for (const m of prev) {
    if (m.id != null) byId.set(m.id, m);
    else if (m.clientMsgId) pendingByClientId.set(m.clientMsgId, m);
  }

  for (const m of incoming) {
    if (m.id == null) continue;
    byId.set(m.id, m);
    if (m.clientMsgId) pendingByClientId.delete(m.clientMsgId);
  }

  return [...byId.values(), ...pendingByClientId.values()].sort((a, b) => {
    const at = a.sentAt ? Date.parse(a.sentAt) : Number.MAX_SAFE_INTEGER;
    const bt = b.sentAt ? Date.parse(b.sentAt) : Number.MAX_SAFE_INTEGER;
    return bt - at;
  });
}

function newestSentAt(messages: GroupChatDTO[]): string | null {
  let newest: string | null = null;
  for (const m of messages) {
    if (m.sentAt && (newest === null || Date.parse(m.sentAt) > Date.parse(newest))) {
      newest = m.sentAt;
    }
  }
  return newest;
}

/**
 * Live job thread over polling.
 *
 * Polls only while `open` and the tab is visible — a closed drawer costs
 * nothing. See CHAT_NOTIFICATIONS_SYSTEM_DESIGN.md §2 for why polling rather
 * than SSE/WebSocket.
 */
export function useJobThread(dbId: string | number | undefined, open: boolean) {
  const notifications = useNotifications();

  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<string | null>(null);
  const intervalRef = useRef(THREAD_INTERVAL_MS);
  const readSentRef = useRef<number>(0);

  // A new job means a new conversation: drop the old one rather than letting
  // it flash before the fetch lands.
  useEffect(() => {
    setMessages([]);
    setError(null);
    cursorRef.current = null;
    readSentRef.current = 0;
  }, [dbId]);

  const fetchPage = useCallback(async () => {
    if (!dbId) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const page = await listJobMessages(dbId, {
        since: cursorRef.current,
        page: 0,
        size: 30,
      });
      const incoming = page.content ?? [];
      if (incoming.length > 0) {
        setMessages((prev) => mergeMessages(prev, incoming));
        cursorRef.current = newestSentAt(incoming) ?? cursorRef.current;
      }
      setError(null);
      intervalRef.current = THREAD_INTERVAL_MS;
    } catch (e) {
      intervalRef.current = Math.min(intervalRef.current * 2, MAX_INTERVAL_MS);
      setError(e instanceof Error ? e.message : "Could not load the thread");
    }
  }, [dbId]);

  useEffect(() => {
    if (!open || !dbId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(async () => {
        await fetchPage();
        schedule();
      }, intervalRef.current);
    };

    setLoading(true);
    void fetchPage().finally(() => {
      if (!cancelled) setLoading(false);
    });
    schedule();

    const onVisibility = () => {
      if (!document.hidden) void fetchPage();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open, dbId, fetchPage]);

  /**
   * Post with an optimistic bubble.
   *
   * The same `clientMsgId` is reused on retry, so a resend after a failure
   * cannot double-post — the server's unique index resolves it to the
   * original row.
   */
  const send = useCallback(
    async (body: string, existingClientMsgId?: string) => {
      const trimmed = body.trim();
      if (!trimmed || !dbId) return;

      const clientMsgId = existingClientMsgId ?? newClientMsgId();

      setMessages((prev) => [
        {
          clientMsgId,
          body: trimmed,
          sentAt: new Date().toISOString(),
          pending: true,
        },
        ...prev.filter((m) => m.clientMsgId !== clientMsgId),
      ]);

      try {
        const saved = await postJobMessage(dbId, trimmed, { clientMsgId });
        setMessages((prev) => mergeMessages(prev, [saved]));
        if (saved.sentAt) cursorRef.current = saved.sentAt;
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === clientMsgId
              ? { ...m, pending: false, failed: true }
              : m
          )
        );
        setError(e instanceof Error ? e.message : "Could not send that message");
      }
    },
    [dbId]
  );

  const retry = useCallback(
    (message: PendingMessage) => {
      if (!message.clientMsgId) return;
      void send(message.body, message.clientMsgId);
    },
    [send]
  );

  /**
   * Tell the server how far this user has read, which also clears their
   * notifications for this job.
   *
   * Guarded by `readSentRef` so an open drawer does not re-POST the same
   * watermark on every 5s tick.
   */
  const markRead = useCallback(async () => {
    if (!dbId) return;
    const highest = messages.reduce(
      (max, m) => (m.id != null && m.id > max ? m.id : max),
      0
    );
    if (highest === 0 || highest <= readSentRef.current) return;

    readSentRef.current = highest;
    try {
      await markThreadRead(dbId, highest);
      // The dot may have just gone out; reflect it without waiting up to 45s.
      await notifications?.refresh();
    } catch {
      // Let the next attempt retry rather than surfacing an error for a
      // background bookkeeping call.
      readSentRef.current = 0;
    }
  }, [dbId, messages, notifications]);

  return { messages, loading, error, send, retry, markRead };
}
