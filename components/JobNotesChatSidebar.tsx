"use client";

import { useCallback } from "react";
import { ArrowUp, Shield, X } from "lucide-react";
import { DEMO_DIRECTOR_CHAT, type DemoChatMessage } from "@/lib/jobNotesChatDemo";

interface JobNotesChatSidebarProps {
  jobId: string;
  systemNote: string;
  notes: string[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onPostNote: () => void;
  onClose?: () => void;
  fillHeight?: boolean;
  className?: string;
}

const DEMO_PREVIEW = DEMO_DIRECTOR_CHAT.slice(0, 3);

const AVATAR_TONES: Record<string, string> = {
  "Dirk B": "bg-slate-700 text-white",
  "Steve B": "bg-[#EA580C] text-white",
  Hugh: "bg-indigo-600 text-white",
  Dave: "bg-teal-700 text-white",
  System: "bg-slate-400 text-white",
  Team: "bg-amber-600 text-white",
};

function avatarTone(author: string) {
  return AVATAR_TONES[author] ?? "bg-slate-600 text-white";
}

function ThreadMessage({
  author,
  initials,
  time,
  body,
  align = "left",
  variant = "message",
}: {
  author: string;
  initials: string;
  time: string;
  body: string;
  align?: "left" | "right";
  variant?: "message" | "system" | "live";
}) {
  const isRight = align === "right";

  return (
    <div
      className={`relative flex gap-3 ${isRight ? "flex-row-reverse text-right" : ""}`}
    >
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ring-2 ring-[#FAFBFC] ${avatarTone(author)}`}
        aria-hidden
      >
        {initials}
      </span>
      <div className={`min-w-0 flex-1 ${isRight ? "items-end" : ""}`}>
        <div
          className={`mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0 ${isRight ? "justify-end" : ""}`}
        >
          <span className="text-[11px] font-semibold text-slate-800">{author}</span>
          <span className="text-[10px] text-slate-400">{time}</span>
        </div>
        <div
          className={`inline-block max-w-[95%] rounded-2xl px-3 py-2 text-left text-xs leading-relaxed shadow-sm ${
            variant === "system"
              ? "border border-slate-200/80 bg-white text-slate-600"
              : variant === "live"
                ? "border border-amber-200/60 bg-amber-50/50 text-slate-800"
                : isRight
                  ? "rounded-br-md bg-slate-900 text-slate-50"
                  : "rounded-bl-md border border-slate-200/70 bg-white text-slate-800"
          }`}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function DemoChatBubble({ message }: { message: DemoChatMessage }) {
  return (
    <ThreadMessage
      author={message.author}
      initials={message.initials}
      time={message.time}
      body={message.body}
      align={message.isSelf ? "right" : "left"}
    />
  );
}

export function JobNotesChatSidebar({
  jobId,
  systemNote,
  notes,
  noteDraft,
  onNoteDraftChange,
  onPostNote,
  onClose,
  fillHeight = false,
  className = "",
}: JobNotesChatSidebarProps) {
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onPostNote();
    },
    [onPostNote]
  );

  return (
    <aside
      className={`flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-[#FAFBFC] shadow-[0_12px_32px_rgba(15,23,42,0.08)] ${className}`}
      aria-label={`Director channel for job ${jobId}`}
    >
      <header className="shrink-0 border-b border-slate-800/20 bg-slate-900 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-orange-400">
              Job communications
            </p>
            <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-white">
              Director channel
            </h3>
            <p className="mt-1 truncate text-[11px] text-slate-400">
              {jobId} · Directors & leadership only
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Active
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close director channel"
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
          className={`relative min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-3 ${
            fillHeight ? "flex-1" : "max-h-[200px]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-orange-200/50 bg-orange-50/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-800/90">
              Preview thread
            </span>
            <span className="text-[10px] text-slate-400">Sample director coordination</span>
          </div>

          <div
            className="relative space-y-4 pl-1"
            aria-label="Sample director conversation"
          >
            <div
              className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent"
              aria-hidden
            />
            {DEMO_PREVIEW.map((message) => (
              <DemoChatBubble key={message.id} message={message} />
            ))}
          </div>

          <div className="relative pt-1">
            <p className="mb-3 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Job activity
            </p>
            <ThreadMessage
              author="System"
              initials="S"
              time="Automated"
              body={systemNote}
              variant="system"
            />
          </div>

          {notes.length === 0 ? (
            <p className="text-center text-[11px] text-slate-400">
              No live messages yet — be the first to post.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((n, i) => (
                <ThreadMessage
                  key={`${i}-${n.slice(0, 24)}`}
                  author="Team"
                  initials="T"
                  time="Just now"
                  body={n}
                  variant="live"
                  align="right"
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
          Message directors and team
        </label>
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 shadow-inner transition-[border-color,box-shadow] focus-within:border-orange-300/70 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]">
          <div className="mb-1.5 hidden shrink-0 sm:flex">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500">
              <Shield className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <textarea
            id={`job-note-${jobId}`}
            value={noteDraft}
            onChange={(e) => onNoteDraftChange(e.target.value)}
            placeholder="Write to directors…"
            rows={2}
            className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!noteDraft.trim()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
            aria-label="Post message"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          Messages are visible to all directors on this job.
        </p>
      </form>
    </aside>
  );
}
