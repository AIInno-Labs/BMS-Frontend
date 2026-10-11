"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { useAuth } from "@/context/AuthContext";
import {
  deleteParameter,
  listOrganizations,
  listParameters,
  upsertParameter,
} from "@/lib/frp/api";
import type { ApplicationParameterDTO, OrganizationDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const SECRET_SUFFIXES = ["_SECRET", "_API_KEY"];

function isSecretParam(name: string) {
  return SECRET_SUFFIXES.some((s) => name.endsWith(s));
}

function groupOf(name: string): "SharePoint" | "Quotient" | "Other" {
  if (name.startsWith("SHAREPOINT_")) return "SharePoint";
  if (name.startsWith("QUOTIENT_")) return "Quotient";
  return "Other";
}

function maskValue(row: ApplicationParameterDTO) {
  const v = row.paramValue ?? "";
  if (!v) return "—";
  if (isSecretParam(row.paramName)) return "••••••••";
  return v;
}

export function ParametersAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOrg = searchParams.get("organizationId");

  const [scope, setScope] = useState<"platform" | "org">(
    initialOrg ? "org" : "platform"
  );
  const [orgId, setOrgId] = useState<number | "">(
    initialOrg && !Number.isNaN(Number(initialOrg)) ? Number(initialOrg) : ""
  );
  const [orgs, setOrgs] = useState<OrganizationDTO[]>([]);
  const [params, setParams] = useState<ApplicationParameterDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ApplicationParameterDTO | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editOrgEditable, setEditOrgEditable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "superadmin") {
      router.replace(appRole === "orgadmin" ? "/org" : "/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  useEffect(() => {
    if (appRole !== "superadmin") return;
    void (async () => {
      try {
        const res = await listOrganizations(0, 100);
        setOrgs(res.content ?? []);
      } catch {
        setOrgs([]);
      }
    })();
  }, [appRole]);

  const load = useCallback(async () => {
    if (appRole !== "superadmin") return;
    if (scope === "org" && orgId === "") {
      setParams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listParameters(scope === "org" ? Number(orgId) : null);
      setParams(list);
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load parameters"
      );
      setParams([]);
    } finally {
      setLoading(false);
    }
  }, [appRole, scope, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map: Record<string, ApplicationParameterDTO[]> = {
      SharePoint: [],
      Quotient: [],
      Other: [],
    };
    for (const p of params) {
      map[groupOf(p.paramName)].push(p);
    }
    return map;
  }, [params]);

  function openEdit(row: ApplicationParameterDTO) {
    setEditRow(row);
    setEditValue(isSecretParam(row.paramName) ? "" : (row.paramValue ?? ""));
    setEditOrgEditable(Boolean(row.orgEditable));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    setError(null);
    try {
      const organizationId =
        scope === "org" ? Number(orgId) : undefined;
      const payload: ApplicationParameterDTO = {
        paramName: editRow.paramName,
        paramValue:
          isSecretParam(editRow.paramName) && editValue === ""
            ? editRow.paramValue ?? ""
            : editValue,
        paramType: editRow.paramType ?? "String",
      };
      if (!editRow.inherited && editRow.id != null) {
        payload.id = editRow.id;
      }
      if (organizationId != null) {
        payload.organizationId = organizationId;
      }
      if (editRow.description) {
        payload.description = editRow.description;
      }
      if (scope === "platform") {
        payload.orgEditable = editOrgEditable;
      }
      await upsertParameter(payload);
      setEditRow(null);
      await load();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Save failed"
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteOverride(row: ApplicationParameterDTO) {
    if (!row.id || row.inherited) return;
    if (!window.confirm(`Delete override for ${row.paramName}?`)) return;
    setError(null);
    try {
      await deleteParameter(row.id);
      await load();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Delete failed"
      );
    }
  }

  const isBoolean = (editRow?.paramType ?? "").toLowerCase() === "boolean";

  if (authLoading || appRole !== "superadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  function renderTable(rows: ApplicationParameterDTO[]) {
    if (rows.length === 0) {
      return (
        <p className="px-4 py-6 text-sm text-slate-500">No parameters in this group.</p>
      );
    }
    return (
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Org editable</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.paramName}-${row.id ?? "inherited"}`}
              className="border-b border-slate-100"
            >
              <td className="px-4 py-3 font-medium text-slate-900">
                {row.paramName}
                {row.description ? (
                  <p className="mt-0.5 text-xs font-normal text-slate-500">
                    {row.description}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-slate-600">{row.paramType ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-slate-800">
                {maskValue(row)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.orgEditable ? "Yes" : "No"}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {row.inherited
                  ? "Inherited"
                  : scope === "platform"
                    ? "Platform"
                    : "Override"}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  {scope === "org" && !row.inherited && row.id != null && (
                    <button
                      type="button"
                      onClick={() => void onDeleteOverride(row)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Super Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">
              Application parameters
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Platform catalog controls which keys Org Admins may edit. Connection
              settings (SharePoint / Quotient) are typically org-editable.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="app-card mt-6 !p-4 sm:!p-5">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className={labelClass} htmlFor="scope">
                Scope
              </label>
              <select
                id="scope"
                className={inputClass}
                value={scope}
                onChange={(e) => {
                  const v = e.target.value as "platform" | "org";
                  setScope(v);
                  if (v === "platform") setOrgId("");
                }}
              >
                <option value="platform">Platform (catalog)</option>
                <option value="org">Organization</option>
              </select>
            </div>
            {scope === "org" && (
              <div className="min-w-[240px] flex-1">
                <label className={labelClass} htmlFor="org">
                  Organization
                </label>
                <select
                  id="org"
                  className={inputClass}
                  value={orgId === "" ? "" : String(orgId)}
                  onChange={(e) =>
                    setOrgId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Select organization…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.companyName} ({o.companyCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : scope === "org" && orgId === "" ? (
          <p className="mt-4 text-sm text-slate-500">Select an organization.</p>
        ) : (
          (["SharePoint", "Quotient", "Other"] as const).map((group) => (
            <div key={group} className="app-card mt-4 overflow-x-auto !p-0">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-[#111827]">
                {group}
              </div>
              {renderTable(grouped[group])}
            </div>
          ))
        )}
      </div>

      <EnterpriseDrawer
        open={Boolean(editRow)}
        onClose={() => setEditRow(null)}
        title={editRow ? `Edit ${editRow.paramName}` : "Edit parameter"}
      >
        {editRow && (
          <form onSubmit={onSave} className="space-y-4">
            <p className="text-sm text-slate-600">
              {scope === "org" && editRow.inherited
                ? "Saving creates an organization override."
                : "Update the parameter value."}
            </p>
            {scope === "platform" && (
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editOrgEditable}
                  onChange={(e) => setEditOrgEditable(e.target.checked)}
                />
                Org Admins may edit this parameter for their organization
              </label>
            )}
            {isBoolean ? (
              <div>
                <label className={labelClass} htmlFor="boolVal">
                  Value
                </label>
                <select
                  id="boolVal"
                  className={inputClass}
                  value={editValue.toLowerCase() === "true" ? "true" : "false"}
                  onChange={(e) => setEditValue(e.target.value)}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="val">
                  Value
                  {isSecretParam(editRow.paramName)
                    ? " (leave blank to keep existing)"
                    : ""}
                </label>
                <input
                  id="val"
                  type={isSecretParam(editRow.paramName) ? "password" : "text"}
                  className={inputClass}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </EnterpriseDrawer>
    </main>
  );
}
