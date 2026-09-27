"use client";

import { FormEvent, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { createPrivilege } from "@/lib/frp/api";
import {
  API_CREATABLE_PRIVILEGE_TYPES,
  PRIVILEGE_CODE_HINT,
  type ApiCreatablePrivilegeType,
  type FieldAccessMode,
} from "@/lib/frp/privilege-types";
import type { PrivilegeDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";
import { PrivilegeSchema } from "@/lib/schemas/privilege";
import { fieldErrorsFrom } from "@/lib/schemas/shared";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

interface CreatePrivilegeDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePrivilegeDrawer({
  open,
  onClose,
  onCreated,
}: CreatePrivilegeDrawerProps) {
  const [privilege, setPrivilege] = useState("");
  const [privilegeCode, setPrivilegeCode] = useState("");
  const [privilegeType, setPrivilegeType] =
    useState<ApiCreatablePrivilegeType>("MENU");
  const [domain, setDomain] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [accessMode, setAccessMode] = useState<FieldAccessMode>("READ");
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPrivilege("");
    setPrivilegeCode("");
    setPrivilegeType("MENU");
    setDomain("");
    setFieldKey("");
    setAccessMode("READ");
    setSortOrder("0");
    setError(null);
    setFieldErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = PrivilegeSchema.safeParse({
      privilegeType,
      privilege,
      privilegeCode,
      domain,
      fieldKey,
      accessMode,
      sortOrder,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      const data = parsed.data;
      const body: PrivilegeDTO = {
        privilege: data.privilege,
        privilegeCode: data.privilegeCode.toUpperCase(),
        privilegeType: data.privilegeType,
        domain: data.domain || undefined,
        sortOrder: data.sortOrder,
      };
      if (data.privilegeType === "FIELD") {
        body.fieldKey = data.fieldKey?.trim();
        body.accessMode = data.accessMode;
      }
      await createPrivilege(body);
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to create privilege"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EnterpriseDrawer
      open={open}
      onClose={handleClose}
      title="Create privilege"
      subtitle="API can create MENU or FIELD privileges only (ACTION codes are system-managed)."
      panelClassName="md:w-[min(640px,92vw)]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-privilege-form"
            className="btn-primary w-full disabled:opacity-60 sm:w-auto"
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create privilege"}
          </button>
        </div>
      }
    >
      <form
        id="create-privilege-form"
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <div>
          <label className={labelClass} htmlFor="priv-type">
            Type *
          </label>
          <select
            id="priv-type"
            className={inputClass}
            value={privilegeType}
            onChange={(e) =>
              setPrivilegeType(e.target.value as ApiCreatablePrivilegeType)
            }
          >
            {API_CREATABLE_PRIVILEGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="priv-label">
            Label *
          </label>
          <input
            id="priv-label"
            className={inputClass}
            required
            value={privilege}
            onChange={(e) => setPrivilege(e.target.value)}
            placeholder="Jobs menu"
          />
          {fieldErrors.privilege && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.privilege}</p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="priv-code">
            Code *
          </label>
          <input
            id="priv-code"
            className={inputClass}
            required
            value={privilegeCode}
            onChange={(e) => setPrivilegeCode(e.target.value)}
            placeholder={
              privilegeType === "MENU" ? "MENU_JOBS" : "FIELD_JOB_NOTES_READ"
            }
          />
          <p className="mt-1 text-xs text-slate-500">
            {PRIVILEGE_CODE_HINT[privilegeType]}
          </p>
          {fieldErrors.privilegeCode && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.privilegeCode}</p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="priv-domain">
            Domain
          </label>
          <input
            id="priv-domain"
            className={inputClass}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="JOBS"
          />
        </div>
        {privilegeType === "FIELD" && (
          <>
            <div>
              <label className={labelClass} htmlFor="priv-fieldKey">
                Field key *
              </label>
              <input
                id="priv-fieldKey"
                className={inputClass}
                required
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
              />
              {fieldErrors.fieldKey && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.fieldKey}</p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="priv-access">
                Access mode *
              </label>
              <select
                id="priv-access"
                className={inputClass}
                value={accessMode}
                onChange={(e) =>
                  setAccessMode(e.target.value as FieldAccessMode)
                }
              >
                <option value="READ">READ (view field)</option>
                <option value="WRITE">WRITE (edit field)</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label className={labelClass} htmlFor="priv-sort">
            Sort order
          </label>
          <input
            id="priv-sort"
            type="number"
            className={inputClass}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
          {fieldErrors.sortOrder && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.sortOrder}</p>
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
