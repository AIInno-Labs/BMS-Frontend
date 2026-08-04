"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface EnterpriseDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  ariaLabelledBy?: string;
  /** Desktop panel width; defaults to responsive 40% / 560px max. */
  panelClassName?: string;
}

export function EnterpriseDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  ariaLabelledBy = "drawer-title",
  panelClassName,
}: EnterpriseDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!open || !mounted) return null;

  const panelWidthClass =
    panelClassName ?? "md:w-[min(560px,92vw)]";

  return createPortal(
    <div className="fixed inset-0 z-[100] animate-[fadeIn_0.2s_ease-out]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-label="Close drawer"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        className={`absolute top-0 right-0 z-10 flex h-full w-full max-w-full flex-col border-l border-[#E2E8F0] bg-white shadow-xl animate-[slideInRight_0.28s_ease-out] max-md:rounded-none ${panelWidthClass}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="min-w-0 pr-2">
            <h2
              id={ariaLabelledBy}
              className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-150 ease-in-out hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-[#F8FAFC] px-5 py-5 sm:px-6">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 border-t border-[#E2E8F0] bg-white px-5 py-4 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}
