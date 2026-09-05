"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { createRole, listPrivileges, updateRole } from "@/lib/frp/api";
import { DASHBOARD_CARD_PRIVILEGE_GROUPS } from "@/lib/frp/access";
import type { PrivilegeDTO, RoleDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";
import { CreateRoleSchema, RoleNameSchema } from "@/lib/schemas/role";
import { fieldErrorsFrom } from "@/lib/schemas/shared";
import { InlineLoading } from "@/components/ui/Loading";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

/** Types Org Admin can assign on custom roles. Platform-only codes are never shown. */
const ASSIGNABLE_TYPES = new Set(["ACTION", "MENU", "FIELD"]);

const TYPE_HINT: Record<string, string> = {
  MENU: "— sidebar / screens (AppNav)",
  ACTION: "— API endpoints",
  FIELD: "— per-field UI (FieldGate)",
};

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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingPrivs, setLoadingPrivs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
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
        const list = await listPrivileges({ active: true });
        if (cancelled) return;
        setPrivileges(
          (list ?? []).filter(
            (p) =>
              Boolean(p.privilegeCode) &&
              !p.platformOnly &&
              p.privilegeCode !== "JOB_EMAIL_RECIPIENT_MANAGE" &&
              ASSIGNABLE_TYPES.has((p.privilegeType ?? "").toUpperCase()),
          ),
        );
      } catch {
        if (!cancelled) setPrivileges([]);
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
    const typeOrder = ["MENU", "ACTION", "FIELD"] as const;
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
            a.localeCompare(b),
          ),
        };
      });
  }, [privileges]);

  /** The Dashboard-card group `code` belongs to, if any — these 4-code sets
   *  must be granted/revoked as a unit (see DASHBOARD_CARD_PRIVILEGE_GROUPS)
   *  so a role only ever ends up holding 0, 4, or 8 of the 8 card codes. */
  function dashboardCardGroupFor(code: string): readonly string[] | null {
    return (
      DASHBOARD_CARD_PRIVILEGE_GROUPS.find((group) => group.includes(code)) ??
      null
    );
  }

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const group = dashboardCardGroupFor(code);
      if (group) {
        // Partially or fully selected -> clear the whole group; none
        // selected -> select the whole group. Either way it lands on a
        // complete group, never a partial one.
        const allSelected = group.every((c) => next.has(c));
        for (const c of group) {
          if (allSelected) next.delete(c);
          else next.add(c);
        }
        return next;
      }
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
    setFieldErrors({});
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (isEdit) {
      const parsed = RoleNameSchema.safeParse({ role });
      if (!parsed.success) {
        setFieldErrors(fieldErrorsFrom(parsed.error));
        return;
      }
    } else {
      const parsed = CreateRoleSchema.safeParse({ role, roleCode });
      if (!parsed.success) {
        setFieldErrors(fieldErrorsFrom(parsed.error));
        return;
      }
    }
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
              : "Failed to create role",
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
          : "Assign ACTION (API), MENU (sidebar), and FIELD (per-field) privileges for this organization."
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
          {fieldErrors.role && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
          )}
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
          {fieldErrors.roleCode && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.roleCode}</p>
          )}
        </div>

        <div>
          <p className={labelClass}>Privileges *</p>
          <p className="mt-1 text-xs text-slate-500">
            MENU = sidebar visibility (e.g. MENU_JOBS). ACTION = API access
            (e.g. JOB_READ). FIELD = per-field UI (e.g. FIELD_JOB_RATE →
            fieldKey "rate"). Assign MENU for sidebar, ACTION for API, FIELD for
            controls.
          </p>
          {loadingPrivs ? (
            <div className="mt-2">
              <InlineLoading label="Loading privileges…" />
            </div>
          ) : (
            <div className="mt-2 space-y-4 rounded-xl border border-slate-200 p-3">
              {groupedByType.map(({ type, domains }) => (
                <div key={type}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    {type}
                    <span className="ml-2 font-normal text-slate-500">
                      {TYPE_HINT[type] ?? ""}
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

              {groupedByType.length === 0 && (
                <p className="text-sm text-slate-500">
                  No privileges available.
                </p>
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
