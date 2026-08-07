"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling for cancel/delete actions. */
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * In-app confirm dialog — replaces `window.confirm` for destructive / workflow
 * actions. Matches the glass-panel look used by job edit modals.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Keep editing",
  tone = "default",
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open || !mounted) return null;

  const confirmClass =
    tone === "danger"
      ? "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
      : "btn-primary disabled:opacity-60";

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="glass-panel relative z-10 w-full max-w-md rounded-2xl p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {tone === "danger" && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <h3
                id={titleId}
                className="text-lg font-semibold tracking-tight text-[#111827]"
              >
                {title}
              </h3>
              <p id={descId} className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[#E5E7EB] p-1.5 text-slate-500 hover:border-orange-200 hover:text-slate-800 disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${confirmClass} w-full sm:w-auto`}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
