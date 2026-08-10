"use client";

import { useCallback, useEffect, useRef } from "react";
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

function formatTime(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

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
}: {
  message: PendingMessage;
  onRetry: (message: PendingMessage) => void;
}) {
  const name = message.sentByName ?? "You";
  const initials = message.sentByInitials ?? "•";

  return (
    <div className="relative flex gap-3">
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-[#FAFBFC] ${avatarTone(name)}`}
        aria-hidden
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[11px] font-semibold text-slate-800">{name}</span>
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
          className={`inline-block max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-3 py-2 text-left text-xs leading-relaxed shadow-sm ${
            message.failed
              ? "border border-rose-200 bg-rose-50 text-rose-900"
              : message.pending
                ? "border border-slate-200/70 bg-white text-slate-400"
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
}: JobNotesChatSidebarProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSend();
    },
    [onSend]
  );

  // Newest-first from the server, rendered newest-first, so "the latest" is at
  // the top and no scroll-to-bottom dance is needed.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [messages.length]);

  // Report "the user is looking at this" so the caller can advance the read
  // watermark. Runs when the list changes rather than on a timer.
  useEffect(() => {
    if (messages.length > 0) onVisible?.();
  }, [messages, onVisible]);

  const canSend = draft.trim().length > 0;
  const mentionsAll = /(?<![\w./@-])@all\b/i.test(draft);

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
            <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-white">
              Job chat
            </h3>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {jobId} · Everyone with chat access
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
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
            <div className="relative space-y-4 pl-1">
              <div
                className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent"
                aria-hidden
              />
              {messages.map((m) => (
                <ThreadMessage
                  key={m.id ?? m.clientMsgId ?? m.sentAt}
                  message={m}
                  onRetry={onRetry}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-slate-200 bg-white px-3 py-3"
      >
        <label htmlFor={`job-note-${jobId}`} className="sr-only">
          Message the team on this job
        </label>
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 shadow-inner transition-[border-color,box-shadow] focus-within:border-orange-300/70 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]">
          <div className="mb-1.5 hidden shrink-0 sm:flex">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500">
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
            rows={2}
            className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"
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
          {mentionsAll ? (
            <span className="font-semibold text-orange-700">
              @all will notify everyone with chat access
            </span>
          ) : (
            "Visible to everyone with chat access on this job."
          )}
        </p>
      </form>
    </aside>
  );
}
