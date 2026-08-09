"use client";

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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-orange-300"
      />
    </label>
  );
}

export function EditModal({
  open,
  title,
  onClose,
  children,
  headerAction,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl p-5">
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
