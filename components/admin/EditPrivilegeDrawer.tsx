"use client";

import { FormEvent, useEffect, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { updatePrivilege } from "@/lib/frp/api";
import type { PrivilegeDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

interface EditPrivilegeDrawerProps {
  open: boolean;
  privilege: PrivilegeDTO | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditPrivilegeDrawer({
  open,
  privilege,
  onClose,
  onUpdated,
}: EditPrivilegeDrawerProps) {
  const [label, setLabel] = useState("");
  const [domain, setDomain] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [accessMode, setAccessMode] = useState<"READ" | "WRITE">("READ");
  const [sortOrder, setSortOrder] = useState("0");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editable =
    privilege != null &&
    privilege.privilegeType !== "ACTION" &&
    !privilege.systemManaged;

  useEffect(() => {
    if (!privilege) return;
    setLabel(privilege.privilege ?? "");
    setDomain(privilege.domain ?? "");
    setFieldKey(privilege.fieldKey ?? "");
    setAccessMode(
      privilege.accessMode === "WRITE" ? "WRITE" : "READ"
    );
    setSortOrder(String(privilege.sortOrder ?? 0));
    setActive(privilege.active !== false);
    setError(null);
  }, [privilege]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!privilege?.id || !editable) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: PrivilegeDTO = {
        id: privilege.id,
        privilege: label.trim(),
        privilegeCode: privilege.privilegeCode,
        privilegeType: privilege.privilegeType,
        domain: domain.trim() || undefined,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        active,
      };
      if (privilege.privilegeType === "FIELD") {
        body.fieldKey = fieldKey.trim();
        body.accessMode = accessMode;
      }
      await updatePrivilege(privilege.id, body);
      onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update privilege"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EnterpriseDrawer
      open={open}
      onClose={onClose}
      title="Edit privilege"
      subtitle={
        editable
          ? privilege?.privilegeCode
          : "System ACTION privileges cannot be modified"
      }
      panelClassName="md:w-[48%] md:max-w-[640px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-privilege-form"
            className="btn-primary disabled:opacity-60"
            disabled={submitting || !editable}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      {!editable ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This privilege is system-managed or ACTION type and cannot be edited
          via API.
        </p>
      ) : (
        <form id="edit-privilege-form" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Code</label>
            <input className={inputClass} value={privilege?.privilegeCode ?? ""} disabled />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <input className={inputClass} value={privilege?.privilegeType ?? ""} disabled />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-priv-label">
              Label *
            </label>
            <input
              id="edit-priv-label"
              className={inputClass}
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="edit-priv-domain">
              Domain
            </label>
            <input
              id="edit-priv-domain"
              className={inputClass}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          {privilege?.privilegeType === "FIELD" && (
            <>
              <div>
                <label className={labelClass} htmlFor="edit-fieldKey">
                  Field key
                </label>
                <input
                  id="edit-fieldKey"
                  className={inputClass}
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="edit-access">
                  Access mode
                </label>
                <select
                  id="edit-access"
                  className={inputClass}
                  value={accessMode}
                  onChange={(e) =>
                    setAccessMode(e.target.value as "READ" | "WRITE")
                  }
                >
                  <option value="READ">READ</option>
                  <option value="WRITE">WRITE</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className={labelClass} htmlFor="edit-sort">
              Sort order
            </label>
            <input
              id="edit-sort"
              type="number"
              className={inputClass}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </form>
      )}
    </EnterpriseDrawer>
  );
}
