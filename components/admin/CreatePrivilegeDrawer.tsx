"use client";

import { FormEvent, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { createPrivilege } from "@/lib/frp/api";
import type { PrivilegeDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

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
  const [privilegeType, setPrivilegeType] = useState<"MENU" | "FIELD">("MENU");
  const [domain, setDomain] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [accessMode, setAccessMode] = useState<"READ" | "WRITE">("READ");
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);
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
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: PrivilegeDTO = {
        privilege: privilege.trim(),
        privilegeCode: privilegeCode.trim().toUpperCase(),
        privilegeType,
        domain: domain.trim() || undefined,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      };
      if (privilegeType === "FIELD") {
        body.fieldKey = fieldKey.trim();
        body.accessMode = accessMode;
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
      <form id="create-privilege-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="priv-type">
            Type *
          </label>
          <select
            id="priv-type"
            className={inputClass}
            value={privilegeType}
            onChange={(e) => setPrivilegeType(e.target.value as "MENU" | "FIELD")}
          >
            <option value="MENU">MENU</option>
            <option value="FIELD">FIELD</option>
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
            {privilegeType === "MENU"
              ? "Must match MENU_{DOMAIN}[_ITEM]"
              : "Must match FIELD_{DOMAIN}_{FIELD}_{VIEW|EDIT} style"}
          </p>
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
