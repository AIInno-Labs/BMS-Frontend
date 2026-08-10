"use client";

import { useCallback, useEffect, useState } from "react";
import { JobNotesChatSidebar } from "@/components/JobNotesChatSidebar";
import { useJobThread } from "@/hooks/useJobThread";

interface JobNotesChatDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Human-facing job number, for the heading. */
  jobId: string;
  /** Database id — what the API addresses jobs by. */
  dbId?: string;
}

export function JobNotesChatDrawer({
  open,
  onClose,
  jobId,
  dbId,
}: JobNotesChatDrawerProps) {
  const [draft, setDraft] = useState("");

  // The hook polls only while `open`, so a closed drawer costs nothing.
  const { messages, loading, error, send, retry, markRead } = useJobThread(
    dbId,
    open
  );

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    void send(body);
  }, [draft, send]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] animate-[fadeIn_0.2s_ease-out]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close job chat"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Job chat for ${jobId}`}
        className="absolute top-0 right-0 z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-[#FAFBFC] shadow-xl animate-[slideInRight_0.28s_ease-out]"
      >
        {dbId ? (
          <JobNotesChatSidebar
            jobId={jobId}
            messages={messages}
            loading={loading}
            error={error}
            draft={draft}
            onDraftChange={setDraft}
            onSend={handleSend}
            onRetry={retry}
            onVisible={markRead}
            onClose={onClose}
            fillHeight
            className="h-full rounded-none border-0 shadow-none"
          />
        ) : (
          // A job created locally and not yet saved has no database id, so
          // there is no thread to address. Better to say so than to render an
          // empty conversation that silently swallows what someone types.
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm font-semibold text-slate-700">
              Chat unavailable
            </p>
            <p className="text-xs text-slate-500">
              This job has not been saved to the server yet.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
