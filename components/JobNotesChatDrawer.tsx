"use client";

import { useEffect } from "react";
import { JobNotesChatSidebar } from "@/components/JobNotesChatSidebar";

interface JobNotesChatDrawerProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  systemNote: string;
  notes: string[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onPostNote: () => void;
}

export function JobNotesChatDrawer({
  open,
  onClose,
  jobId,
  systemNote,
  notes,
  noteDraft,
  onNoteDraftChange,
  onPostNote,
}: JobNotesChatDrawerProps) {
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
        aria-label="Close director channel"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Director channel for job ${jobId}`}
        className="absolute top-0 right-0 z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-[#FAFBFC] shadow-xl animate-[slideInRight_0.28s_ease-out]"
      >
        <JobNotesChatSidebar
          jobId={jobId}
          systemNote={systemNote}
          notes={notes}
          noteDraft={noteDraft}
          onNoteDraftChange={onNoteDraftChange}
          onPostNote={onPostNote}
          onClose={onClose}
          fillHeight
          className="h-full rounded-none border-0 shadow-none"
        />
      </aside>
    </div>
  );
}
