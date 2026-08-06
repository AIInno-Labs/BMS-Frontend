"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { createRole, listPrivileges, updateRole } from "@/lib/frp/api";
import type { PrivilegeDTO, RoleDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

/** Types Org Admin can assign on custom roles (FIELD stays Super-Admin catalog only for now). */
const ASSIGNABLE_TYPES = new Set(["ACTION", "MENU"]);

interface CreateRoleDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialRole?: RoleDTO | null;
}

export function CreateRoleDrawer({
  open,
  onClose,
  onSaved,
  initialRole = null,
}: CreateRoleDrawerProps) {
  const isEdit = Boolean(initialRole?.id);
  const [role, setRole] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [privileges, setPrivileges] = useState<PrivilegeDTO[]>([]);
  const [platformOnly, setPlatformOnly] = useState<PrivilegeDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrivs, setLoadingPrivs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialRole) {
      setRole(initialRole.role ?? "");
      setRoleCode(initialRole.roleCode ?? "");
      setSelected(new Set(initialRole.privilegeCodes ?? []));
    } else {
      setRole("");
      setRoleCode("");
      setSelected(new Set());
    }
  }, [open, initialRole]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingPrivs(true);
      try {
        // Full active catalog from API (same table Super Admin manages).
        // Backend already strips some platform-only codes for non-platform users;
        // we still split platformOnly for a visible read-only section.
        const list = await listPrivileges({ active: true });
        if (cancelled) return;
        const rows = (list ?? []).filter((p) => p.privilegeCode);
        setPrivileges(
          rows.filter(
            (p) =>
              !p.platformOnly &&
              ASSIGNABLE_TYPES.has((p.privilegeType ?? "").toUpperCase())
          )
        );
        setPlatformOnly(rows.filter((p) => p.platformOnly));
      } catch {
        if (!cancelled) {
          setPrivileges([]);
          setPlatformOnly([]);
        }
      } finally {
        if (!cancelled) setLoadingPrivs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /** Group assignable privileges by type, then domain. */
  const groupedByType = useMemo(() => {
    const typeOrder = ["MENU", "ACTION"] as const;
    const byType = new Map<string, Map<string, PrivilegeDTO[]>>();
    for (const p of privileges) {
      const type = (p.privilegeType ?? "OTHER").toUpperCase();
      const domain = p.domain || "OTHER";
      if (!byType.has(type)) byType.set(type, new Map());
      const domains = byType.get(type)!;
      if (!domains.has(domain)) domains.set(domain, []);
      domains.get(domain)!.push(p);
    }
    return typeOrder
      .filter((t) => byType.has(t))
      .map((type) => {
        const domains = byType.get(type)!;
        return {
          type,
          domains: [...domains.entries()].sort(([a], [b]) =>
            a.localeCompare(b)
          ),
        };
      });
  }, [privileges]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleClose() {
    setRole("");
    setRoleCode("");
    setSelected(new Set());
    setError(null);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one privilege.");
      return;
    }
    setSubmitting(true);
    try {
      const privilegeCodes = [...selected];
      if (isEdit && initialRole?.id != null) {
        await updateRole({
          id: initialRole.id,
          role: role.trim(),
          roleCode: initialRole.roleCode,
          privilegeCodes,
        });
      } else {
        await createRole({
          role: role.trim(),
          roleCode: roleCode.trim().toUpperCase(),
          privilegeCodes,
        });
      }
      handleClose();
      onSaved();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : isEdit
              ? "Failed to update role"
              : "Failed to create role"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EnterpriseDrawer
      open={open}
      onClose={handleClose}
      title={isEdit ? "Edit role" : "Create role"}
      subtitle={
        isEdit
          ? "Update the role name and privileges for this organization."
          : "Assign ACTION (API) and MENU (sidebar) privileges. Platform-only codes are listed below but cannot be granted."
      }
      panelClassName="md:w-[min(640px,92vw)]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="role-form"
            className="btn-primary w-full disabled:opacity-60 sm:w-auto"
            disabled={submitting}
          >
            {submitting
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save"
                : "Create role"}
          </button>
        </div>
      }
    >
      <form id="role-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="roleName">
            Role name *
          </label>
          <input
            id="roleName"
            className={inputClass}
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="roleCode">
            Role code *
          </label>
          <input
            id="roleCode"
            className={`${inputClass}${isEdit ? " bg-slate-50 text-slate-600" : ""}`}
            required
            value={roleCode}
            onChange={(e) => setRoleCode(e.target.value)}
            placeholder="e.g. FLOOR_SUPERVISOR"
            readOnly={isEdit}
            disabled={isEdit}
          />
        </div>

        <div>
          <p className={labelClass}>Privileges *</p>
          <p className="mt-1 text-xs text-slate-500">
            MENU codes control sidebar visibility (e.g. MENU_JOBS). ACTION codes
            control API access (e.g. JOB_READ, JOB_CREATE). Assign both when a
            user should open Jobs and load data.
          </p>
          {loadingPrivs ? (
            <p className="mt-2 text-sm text-slate-500">Loading privileges…</p>
          ) : (
            <div className="mt-2 space-y-4 rounded-xl border border-slate-200 p-3">
              {groupedByType.map(({ type, domains }) => (
                <div key={type}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    {type}
                    <span className="ml-2 font-normal text-slate-500">
                      {type === "MENU"
                        ? "— sidebar / screens"
                        : "— API endpoints"}
                    </span>
                  </p>
                  <div className="space-y-3">
                    {domains.map(([domain, items]) => (
                      <div key={`${type}-${domain}`}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {domain}
                        </p>
                        <div className="space-y-1">
                          {items.map((p) => (
                            <label
                              key={p.privilegeCode}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                checked={selected.has(p.privilegeCode)}
                                onChange={() => toggle(p.privilegeCode)}
                              />
                              <span className="font-medium text-slate-800">
                                {p.privilegeCode}
                              </span>
                              {p.privilege && (
                                <span className="text-xs text-slate-500">
                                  {p.privilege}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {platformOnly.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Platform only
                  </p>
                  <p className="mb-2 text-xs text-slate-500">
                    Visible for reference — Super Admin / platform scope. Cannot
                    be assigned to organization roles (API rejects them).
                  </p>
                  <div className="space-y-1 opacity-70">
                    {platformOnly.map((p) => (
                      <label
                        key={p.privilegeCode}
                        className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-slate-300"
                          checked={false}
                          readOnly
                        />
                        <span className="font-medium text-slate-600">
                          {p.privilegeCode}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                          platform
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {groupedByType.length === 0 && platformOnly.length === 0 && (
                <p className="text-sm text-slate-500">No privileges available.</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </EnterpriseDrawer>
  );
}
