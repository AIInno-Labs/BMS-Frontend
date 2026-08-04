"use client";

import { useEffect, useMemo, useState } from "react";
import { getRoles } from "@/services/administration/role.service";
import type { Privilege } from "@/lib/administration/types";

const MODULE_OPTIONS: Privilege["module"][] = [
  "Organizations",
  "Users",
  "Roles",
  "Privileges",
  "System",
  "Security",
];

const STATUS_OPTIONS: Privilege["status"][] = ["active", "restricted", "inactive"];

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export type PrivilegeDraft = Omit<Privilege, "id">;

export function PrivilegeFormModal({
  privilege,
  onSave,
  onClose,
}: {
  privilege: Privilege | null;
  onSave: (draft: PrivilegeDraft) => void | Promise<void>;
  onClose: () => void;
}) {
  const isEdit = Boolean(privilege);
  const [code, setCode] = useState(privilege?.code ?? "");
  const [description, setDescription] = useState(privilege?.description ?? "");
  const [module, setModule] = useState<Privilege["module"]>(privilege?.module ?? "Users");
  const [status, setStatus] = useState<Privilege["status"]>(privilege?.status ?? "active");
  const [usedByRoles, setUsedByRoles] = useState<string[]>(privilege?.usedByRoles ?? []);
  const [roleOptions, setRoleOptions] = useState<string[]>(["Super Admin"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRoles().then((roles) => setRoleOptions(["Super Admin", ...roles.map((r) => r.name)]));
  }, []);

  const canSave = useMemo(() => code.trim() && description.trim(), [code, description]);

  function toggleRole(name: string) {
    setUsedByRoles((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({ code: code.trim(), description: description.trim(), module, status, usedByRoles });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-[#111827]">
          {isEdit ? "Edit Privilege" : "Create Privilege"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {isEdit
            ? "Update this permission's details and role access."
            : "Define a new granular system permission."}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelClass}>Permission Name (Code) *</label>
            <input
              className={inputClass}
              placeholder="e.g., REPORT_EXPORT"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
            />
          </div>
          <div>
            <label className={labelClass}>Description *</label>
            <input
              className={inputClass}
              placeholder="What does this permission allow?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Module</label>
              <select
                className={inputClass}
                value={module}
                onChange={(e) => setModule(e.target.value as Privilege["module"])}
              >
                {MODULE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as Privilege["status"])}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Used By Roles</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {roleOptions.map((name) => {
                const active = usedByRoles.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleRole(name)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Privilege"}
          </button>
        </div>
      </div>
    </div>
  );
}
