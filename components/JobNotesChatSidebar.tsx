"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowUp, AtSign, Loader2, RotateCw, Shield, X } from "lucide-react";
import type { PendingMessage } from "@/hooks/useJobThread";

interface JobNotesChatSidebarProps {
  jobId: string;
  messages: PendingMessage[];
  loading: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRetry: (message: PendingMessage) => void;
  onVisible?: () => void;
  onClose?: () => void;
  fillHeight?: boolean;
  className?: string;
  canCompose?: boolean;
  /** Whoever's looking at this thread — used to tell "my" bubbles from
   *  everyone else's, so they can render on the right vs. the left. */
  currentUserId?: number;
}

/** Stable colour per author, so the same person keeps the same avatar. */
const AVATAR_TONES = [
  "bg-slate-700 text-white",
  "bg-[#EA580C] text-white",
  "bg-indigo-600 text-white",
  "bg-teal-700 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
];

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

// The date divider now carries the date, so each bubble only needs a time.
function formatTime(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** WhatsApp-style grouping: Today, Yesterday, weekday name within the last
 *  week, then a full date for anything older. */
function formatDateDivider(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY_MS);

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) {
    return d.toLocaleDateString([], { weekday: "long" });
  }
  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/** Calendar-day grouping key — local time, so a message just after midnight
 *  starts a new group even if the poll happens to batch it with the prior day. */
function dayKey(iso?: string): string {
  if (!iso) return "unknown";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "unknown" : new Date(t).toDateString();
}

type ChatRenderItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "message"; key: string | number; message: PendingMessage };

/**
 * Highlights `@all` in a rendered body.
 *
 * Split on the same token shape the server parses, so what reads as a mention
 * is what actually triggered one.
 */
function renderBody(body: string) {
  const parts = body.split(/((?<![\w./@-])@all\b)/gi);
  return parts.map((part, i) =>
    /^@all$/i.test(part) ? (
      <span
        key={i}
        className="rounded bg-orange-100 px-1 font-semibold text-orange-800"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function ThreadMessage({
  message,
  onRetry,
  isMine,
  connectNext,
}: {
  message: PendingMessage;
  onRetry: (message: PendingMessage) => void;
  /** This message is the current viewer's own — renders on the right. */
  isMine: boolean;
  /** The next item in the thread is a message on the same side with no date
   *  divider in between — draw a connector down to it. Runs of consecutive
   *  same-side messages get their own connected line; the line never
   *  crosses from one side to the other. */
  connectNext: boolean;
}) {
  const name = message.sentByName ?? "You";
  const initials = message.sentByInitials ?? "•";

  return (
    <div className={`relative flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-[#FAFBFC] ${avatarTone(
          name
        )}`}
        aria-hidden
      >
        {initials}
      </span>
      {connectNext ? (
        <span
          aria-hidden
          className={`pointer-events-none absolute top-8 bottom-[-16px] w-px bg-gradient-to-b from-slate-200 to-slate-200/40 ${
            isMine ? "right-[15px]" : "left-[15px]"
          }`}
        />
      ) : null}
      <div className={`min-w-0 flex-1 ${isMine ? "flex flex-col items-end" : ""}`}>
        <div
          className={`mb-1 flex flex-wrap items-baseline gap-x-2 ${
            isMine ? "flex-row-reverse" : ""
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-800">
            {name}
          </span>
          <span className="text-[10px] text-slate-400">
            {message.pending ? "Sending…" : formatTime(message.sentAt)}
          </span>
          {message.mentionsAll ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-orange-50 px-1 text-[9px] font-semibold uppercase tracking-wide text-orange-700">
              <AtSign className="h-2.5 w-2.5" aria-hidden />
              all
            </span>
          ) : null}
        </div>
        <div
          className={`inline-block max-w-[95%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-xs leading-relaxed shadow-sm ${
            isMine ? "rounded-br-md" : "rounded-bl-md"
          } ${
            message.failed
              ? "border border-rose-200 bg-rose-50 text-rose-900"
              : message.pending
              ? "border border-slate-200/70 bg-white text-slate-400"
              : isMine
              ? "border border-orange-200 bg-orange-50 text-slate-900"
              : "border border-slate-200/70 bg-white text-slate-800"
          }`}
        >
          {renderBody(message.body)}
        </div>
        {message.failed ? (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 hover:underline"
          >
            <RotateCw className="h-3 w-3" aria-hidden />
            Not sent — retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function JobNotesChatSidebar({
  jobId,
  messages,
  loading,
  error,
  draft,
  onDraftChange,
  onSend,
  onRetry,
  onVisible,
  onClose,
  fillHeight = false,
  className = "",
  canCompose = true,
  currentUserId,
}: JobNotesChatSidebarProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSend();
    },
    [onSend]
  );

  // `messages` arrives newest-first from the server (convenient for the
  // cursor/merge logic in useJobThread) — reversed here purely for display,
  // so the thread reads top-to-bottom oldest-to-newest like a normal chat.
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Interleave a date divider before the first message of each calendar day,
  // same rule WhatsApp uses: Today / Yesterday / weekday / full date.
  const renderItems = useMemo(() => {
    const items: ChatRenderItem[] = [];
    let lastDay: string | null = null;
    for (const m of orderedMessages) {
      const key = dayKey(m.sentAt);
      if (key !== lastDay) {
        items.push({ kind: "divider", key: `divider-${key}`, label: formatDateDivider(m.sentAt) });
        lastDay = key;
      }
      items.push({ kind: "message", key: m.id ?? m.clientMsgId ?? m.sentAt ?? Math.random(), message: m });
    }
    return items;
  }, [orderedMessages]);

  // A pending or failed message has no `sentBy` yet — the server hasn't
  // echoed it back — but it can only ever be the current viewer's own, since
  // nobody else's composer produces a locally-optimistic row.
  const isMine = useCallback(
    (m: PendingMessage) =>
      m.pending === true ||
      m.failed === true ||
      (currentUserId != null && m.sentBy === currentUserId),
    [currentUserId]
  );

  // Auto-scroll to the newest message (bottom) whenever the thread grows —
  // covers first load, polling in new messages, and sending your own.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Report "the user is looking at this" so the caller can advance the read
  // watermark. Runs when the list changes rather than on a timer.
  useEffect(() => {
    if (messages.length > 0) onVisible?.();
  }, [messages, onVisible]);

  const canSend = draft.trim().length > 0;

  return (
    <aside
      className={`flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-[#FAFBFC] shadow-[0_12px_32px_rgba(15,23,42,0.08)] ${className}`}
      aria-label={`Job chat for ${jobId}`}
    >
      <header className="shrink-0 border-b border-slate-800/20 bg-slate-900 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-orange-400">
              Job communications
            </p>
            <h3 className="mt-0.5 truncate text-sm font-semibold tracking-tight text-white">
              {jobId}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                aria-hidden
              />
              Live
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close job chat"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(249,115,22,0.04),transparent)]" />

        <div
          ref={scrollRef}
          className={`relative min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 ${
            fillHeight ? "flex-1" : "max-h-[200px]"
          }`}
        >
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
              {error}
            </p>
          ) : null}

          {loading && messages.length === 0 ? (
            <p className="flex items-center justify-center gap-2 py-6 text-[11px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading conversation…
            </p>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-slate-400">
              No messages yet — be the first to post.
            </p>
          ) : (
            <div className="relative space-y-4 px-1">
              {renderItems.map((item, idx) => {
                if (item.kind === "divider") {
                  return (
                    <div
                      key={item.key}
                      className="relative z-10 flex justify-center py-1"
                    >
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
                        {item.label}
                      </span>
                    </div>
                  );
                }
                const mine = isMine(item.message);
                // Connect to the next message only when it's on the same
                // side (both mine, or both someone else's) — the line never
                // crosses from the left column to the right column.
                const next = renderItems[idx + 1];
                const connectNext =
                  next?.kind === "message" && isMine(next.message) === mine;
                return (
                  <ThreadMessage
                    key={item.key}
                    message={item.message}
                    onRetry={onRetry}
                    isMine={mine}
                    connectNext={connectNext}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!canCompose ? (
        <p className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 text-center text-[11px] text-slate-500">
          You have read-only access to this chat.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-slate-200 bg-white px-3 py-3"
        >
          <label htmlFor={`job-note-${jobId}`} className="sr-only">
            Message the team on this job
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 shadow-inner transition-[border-color,box-shadow] focus-within:border-orange-300/70 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]">
            <div className="hidden shrink-0 sm:flex">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500">
                <Shield className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <textarea
              id={`job-note-${jobId}`}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — the convention
                // every chat app has trained people to expect.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) onSend();
                }
              }}
              placeholder="Write to the team… type @all to notify everyone"
              rows={1}
              className="max-h-24 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-xs leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            @all will notify everyone in this chat
          </p>
        </form>
      )}
    </aside>
  );
}
