"use client";

import { Pencil } from "lucide-react";

/**
 * Shared card shell used across the job dashboard widgets (Customer Details,
 * Job Details, Manufacturing, Status Control, Purchase Orders, ...).
 *
 * Pulled out of JobWorkflowDashboard.tsx so every card — including new ones —
 * renders from the exact same markup instead of a copy that can drift.
 */
export function WidgetCard({
  title,
  icon: Icon,
  children,
  onEdit,
  headerAction,
  className,
  id,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onEdit?: () => void;
  headerAction?: React.ReactNode;
  /** Extra classes on the <article>, e.g. "lg:col-span-3" for a full-width card. */
  className?: string;
  id?: string;
}) {
  return (
    <article
      id={id}
      className={`group app-card-interactive min-w-0 p-4 sm:p-4${className ? ` ${className}` : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#111827]">
          <Icon className="h-4 w-4 shrink-0 text-[#F97316]" />
          <span className="truncate">{title}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerAction}
          {onEdit && (
            <button
              type="button"
              className="rounded-lg border border-[#E5E7EB] p-1.5 text-slate-500 opacity-100 pointer-events-auto transition-opacity duration-150 hover:border-orange-200 hover:text-[#111827] focus:opacity-100 lg:opacity-0 lg:pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-focus-within:pointer-events-auto"
              onClick={onEdit}
              aria-label={`Edit ${title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1 text-sm text-slate-700">{children}</div>
    </article>
  );
}
