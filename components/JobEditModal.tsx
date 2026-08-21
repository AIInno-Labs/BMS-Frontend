"use client";

import { useEffect } from "react";

/**
 * Shared modal shell + text field, used by every "edit this card" popup on
 * the job dashboard. Pulled out of JobWorkflowDashboard.tsx so new cards
 * (Status Control, Purchase Orders, ...) open the exact same-looking modal
 * instead of a hand-copied one.
 */
export function ModalField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
  multiline = false,
  min,
  step,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Renders a <textarea> instead of a single-line <input>, for longer
   *  free-text fields like remarks/notes. */
  multiline?: boolean;
  min?: number;
  step?: number;
  /** Validation message shown under the field, e.g. from a zod safeParse. */
  error?: string;
}) {
  const fieldClass =
    "mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-orange-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const borderClass = error ? "border-red-400 focus:border-red-400" : "";
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${fieldClass} resize-y ${borderClass}`}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} ${borderClass}`}
        />
      )}
      {error ? <p className="mt-1 text-xs font-normal text-red-600">{error}</p> : null}
    </label>
  );
}

/**
 * A catalog-driven select - no free text. What's selectable here is
 * whatever the org admin has defined in the Inventory catalog
 * (`/org/inventory`, loaded from `GET /master-inventory`), so a job
 * user can only pick from that list, never type something the admin hasn't
 * added. If a line's current value predates the catalog (or was set before
 * the admin added it), it's still shown - as a selected option outside the
 * list - so it isn't silently blanked, but the only way to change it is to
 * pick a real catalog option.
 */
export function ModalCatalogField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  allowBlank = false,
}: {
  label: string;
  value: string;
  /** Options for this field given everything picked upstream. */
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** When some catalog rows leave this field empty. */
  allowBlank?: boolean;
}) {
  const fieldClass =
    "mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-orange-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
  const hasStaleValue = value.trim().length > 0 && !options.includes(value);
  const emptyLabel = allowBlank ? "—" : `Select ${label}`;

  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        <option value="" disabled={!allowBlank && options.length > 0}>
          {emptyLabel}
        </option>
        {hasStaleValue ? (
          <option value={value}>{`${value} (not in catalog)`}</option>
        ) : null}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EditModal({
  open,
  title,
  onClose,
  children,
  headerAction,
  panelClassName,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  /** Extra classes on the panel, e.g. `max-w-5xl` for a wide table editor. */
  panelClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <div
        className={`glass-panel w-full rounded-2xl p-5 ${panelClassName ?? "max-w-md"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-lg font-semibold text-[#111827]">{title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {headerAction}
            <button
              type="button"
              className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-slate-600 hover:border-orange-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
