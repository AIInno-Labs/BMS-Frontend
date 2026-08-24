"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import {
  listOrgParameters,
  upsertOrgParameter,
  regenerateQuotientWebhookToken,
} from "@/lib/frp/api";
import type { ApplicationParameterDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const SECRET_SUFFIXES = ["_SECRET", "_API_KEY"];

// Backend-managed: written by the "Generate token" action, never hand-edited.
const GENERATED_PARAMS = new Set([
  "QUOTIENT_WEBHOOK_TOKEN",
  "QUOTIENT_WEBHOOK_URL",
]);

/** Derived by the backend from SHAREPOINT_SITE_URL — never typed or saved here. */
const SHAREPOINT_DRIVE_ID = "SHAREPOINT_DRIVE_ID";
const SHAREPOINT_SITE_URL = "SHAREPOINT_SITE_URL";

/** Credentials and toggles must hit the DB before the site URL (drive resolve). */
const SHAREPOINT_SAVE_BEFORE_SITE = [
  "SHAREPOINT_ENABLED",
  "SHAREPOINT_TENANT_ID",
  "SHAREPOINT_CLIENT_ID",
  "SHAREPOINT_CLIENT_SECRET",
];

function isSecretParam(name: string) {
  return SECRET_SUFFIXES.some((s) => name.endsWith(s));
}

function isGeneratedParam(name: string) {
  return GENERATED_PARAMS.has(name);
}

function isReadOnlyParam(name: string) {
  return isGeneratedParam(name) || name === SHAREPOINT_DRIVE_ID;
}

type IntegrationGroup = "SharePoint" | "Quotient" | "LLM" | "SMTP" | "Other";

const INTEGRATION_GROUPS: IntegrationGroup[] = [
  "SharePoint",
  "Quotient",
  "LLM",
  "SMTP",
  "Other",
];

function groupOf(name: string): IntegrationGroup {
  if (name.startsWith("SHAREPOINT_")) return "SharePoint";
  if (name.startsWith("QUOTIENT_")) return "Quotient";
  if (name.startsWith("LLM_")) return "LLM";
  if (name.startsWith("SMTP2GO_")) return "SMTP";
  return "Other";
}

function integrationLabel(group: IntegrationGroup) {
  return group === "Other" ? "Others" : group;
}

const GROUP_MESSAGE: Partial<Record<IntegrationGroup, string>> = {
  SMTP: "Outbound email through SMTP2GO. From uses the organisation email and company name unless you set sender fields below. Mail is skipped unless this is enabled.",
  Other:
    "OCR (Tesseract fallback for scanned PDFs and images) and remaining org-level toggles that are not SharePoint, Quotient, LLM, or SMTP.",
};

function sharePointSaveOrder(rows: ApplicationParameterDTO[]) {
  const byName = new Map(rows.map((row) => [row.paramName, row]));
  const ordered: ApplicationParameterDTO[] = [];
  for (const name of SHAREPOINT_SAVE_BEFORE_SITE) {
    const row = byName.get(name);
    if (row) ordered.push(row);
  }
  for (const row of rows) {
    if (
      row.paramName === SHAREPOINT_DRIVE_ID ||
      row.paramName === SHAREPOINT_SITE_URL ||
      SHAREPOINT_SAVE_BEFORE_SITE.includes(row.paramName)
    ) {
      continue;
    }
    ordered.push(row);
  }
  const site = byName.get(SHAREPOINT_SITE_URL);
  if (site) ordered.push(site);
  return ordered;
}

export default function OrgIntegrationsPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();
  const [params, setParams] = useState<ApplicationParameterDTO[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<IntegrationGroup | null>(
    null
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole === "superadmin") {
      router.replace("/admin/parameters");
      return;
    }
    if (appRole !== "orgadmin") {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  const load = useCallback(async () => {
    if (appRole !== "orgadmin") return;
    setLoading(true);
    setError(null);
    try {
      const list = await listOrgParameters();
      setParams(list);
      const next: Record<string, string> = {};
      for (const p of list) {
        next[p.paramName] = p.paramValue ?? "";
      }
      setValues(next);
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load integrations"
      );
      setParams([]);
    } finally {
      setLoading(false);
    }
  }, [appRole]);

  const lastLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastLoadedKeyRef.current === appRole) return;
    lastLoadedKeyRef.current = appRole;
    void load();
  }, [load, appRole]);

  const grouped = useMemo(() => {
    const map: Record<IntegrationGroup, ApplicationParameterDTO[]> = {
      SharePoint: [],
      Quotient: [],
      LLM: [],
      SMTP: [],
      Other: [],
    };
    for (const p of params) {
      map[groupOf(p.paramName)].push(p);
    }
    return map;
  }, [params]);

  function onSubmitGroup(e: FormEvent, group: IntegrationGroup) {
    e.preventDefault();
    setConfirmGroup(group);
  }

  async function saveGroup(group: IntegrationGroup) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const rows =
        group === "SharePoint"
          ? sharePointSaveOrder(grouped[group])
          : grouped[group];
      for (const row of rows) {
        if (row.paramName === SHAREPOINT_DRIVE_ID) continue;
        const nextVal = values[row.paramName] ?? "";
        if (isSecretParam(row.paramName) && nextVal === "") {
          continue;
        }
        const current = row.paramValue ?? "";
        // SharePoint credentials must be in the DB before site URL even when
        // only the URL changed; skip unchanged fields for other groups.
        const skipUnchanged =
          group !== "SharePoint" || row.paramName === SHAREPOINT_SITE_URL;
        if (
          skipUnchanged &&
          nextVal === current &&
          !isSecretParam(row.paramName)
        ) {
          continue;
        }
        await upsertOrgParameter({
          id: row.inherited ? undefined : row.id ?? undefined,
          paramName: row.paramName,
          paramValue: nextVal,
          paramType: row.paramType ?? "String",
        });
      }
      setMessage(`${integrationLabel(group)} settings saved.`);
      setConfirmGroup(null);
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

  // Generate a fresh token + URL (no persistence); drop them into the read-only
  // fields. They are stored only when the Quotient group is saved.
  async function generateWebhookToken() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const resp = await regenerateQuotientWebhookToken();
      setValues((prev) => ({
        ...prev,
        QUOTIENT_WEBHOOK_TOKEN: resp.webhookToken ?? "",
        QUOTIENT_WEBHOOK_URL: resp.webhookUrl ?? "",
      }));
      setMessage("Token generated. Click Save Quotient to store it.");
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to generate token"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function copyValue(name: string) {
    const value = values[name] ?? "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(name);
      setTimeout(() => setCopiedField((f) => (f === name ? null : f)), 1500);
    } catch {
      /* clipboard blocked; the field stays selectable as a fallback */
    }
  }

  if (authLoading || appRole !== "orgadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Organization Admin
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#111827]">
          Integrations
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          SharePoint, Quotient, LLM, SMTP, and other connection settings for
          your organization. Only parameters marked org-editable by Super Admin
          appear here.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : (
          INTEGRATION_GROUPS.map((group) => {
            const rows = grouped[group];
            if (rows.length === 0) return null;
            return (
              <form
                key={group}
                onSubmit={(e) => onSubmitGroup(e, group)}
                className="app-card mt-6 space-y-4 !p-5"
              >
                <h3 className="text-sm font-semibold text-[#111827]">
                  {integrationLabel(group)}
                </h3>
                {GROUP_MESSAGE[group] ? (
                  <p className="text-xs leading-relaxed text-slate-500">
                    {GROUP_MESSAGE[group]}
                  </p>
                ) : null}
                {rows.map((row) => {
                  const booleanType =
                    (row.paramType ?? "").toLowerCase() === "boolean";
                  const secret = isSecretParam(row.paramName);
                  const generated = isGeneratedParam(row.paramName);
                  const readOnly = isReadOnlyParam(row.paramName);
                  return (
                    <div key={row.paramName}>
                      <label className={labelClass} htmlFor={row.paramName}>
                        {row.paramName}
                        {row.inherited ? " (using platform default)" : ""}
                        {generated ? " — generated, read-only" : ""}
                        {row.paramName === SHAREPOINT_DRIVE_ID
                          ? " — derived from site URL, read-only"
                          : ""}
                      </label>
                      {row.description ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.description}
                        </p>
                      ) : null}
                      {readOnly ? (
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id={row.paramName}
                            readOnly
                            className={`${inputClass} !mt-0 min-w-0 flex-1 bg-slate-50 font-mono text-xs text-slate-600`}
                            value={values[row.paramName] ?? ""}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder={
                              row.paramName === SHAREPOINT_DRIVE_ID
                                ? "Filled automatically when you save the site URL"
                                : "Generate a token to fill this"
                            }
                          />
                          <button
                            type="button"
                            onClick={() => void copyValue(row.paramName)}
                            disabled={!values[row.paramName]}
                            className="btn-secondary shrink-0 disabled:opacity-60"
                          >
                            {copiedField === row.paramName ? "Copied" : "Copy"}
                          </button>
                          {row.paramName === "QUOTIENT_WEBHOOK_TOKEN" && (
                            <button
                              type="button"
                              onClick={() => void generateWebhookToken()}
                              disabled={generating}
                              className="btn-secondary shrink-0 disabled:opacity-60"
                            >
                              {generating ? "Generating…" : "Generate"}
                            </button>
                          )}
                        </div>
                      ) : booleanType ? (
                        <select
                          id={row.paramName}
                          className={inputClass}
                          value={
                            (values[row.paramName] ?? "false").toLowerCase() ===
                            "true"
                              ? "true"
                              : "false"
                          }
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [row.paramName]: e.target.value,
                            }))
                          }
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : secret ? (
                        <div className="relative mt-1.5">
                          <input
                            id={row.paramName}
                            type={
                              revealedSecrets[row.paramName] ? "text" : "password"
                            }
                            className={`${inputClass} !mt-0 pr-11`}
                            value={values[row.paramName] ?? ""}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                [row.paramName]: e.target.value,
                              }))
                            }
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800"
                            onClick={() =>
                              setRevealedSecrets((prev) => ({
                                ...prev,
                                [row.paramName]: !prev[row.paramName],
                              }))
                            }
                            aria-label={
                              revealedSecrets[row.paramName]
                                ? `Hide ${row.paramName}`
                                : `Show ${row.paramName}`
                            }
                          >
                            {revealedSecrets[row.paramName] ? (
                              <EyeOff className="h-4 w-4" aria-hidden />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      ) : (
                        <input
                          id={row.paramName}
                          type="text"
                          className={inputClass}
                          value={values[row.paramName] ?? ""}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [row.paramName]: e.target.value,
                            }))
                          }
                          autoComplete="off"
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary disabled:opacity-60"
                >
                  {saving ? "Saving…" : `Save ${integrationLabel(group)}`}
                </button>
                {group === "Quotient" && (
                  <p className="text-xs leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-600">
                      Add it in Quotient:
                    </span>{" "}
                    open Account Settings → Integrations → Webhooks, paste the
                    saved <code className="font-mono">QUOTIENT_WEBHOOK_URL</code>{" "}
                    above, and save. Quotient then POSTs each quote event to that
                    URL. Regenerate the token to rotate it — remember to re-paste
                    the new URL.
                  </p>
                )}
              </form>
            );
          })
        )}

        <ConfirmDialog
          open={confirmGroup != null}
          title={`Save ${confirmGroup ? integrationLabel(confirmGroup) : ""} settings?`}
          description={`These values are used for live ${confirmGroup ? integrationLabel(confirmGroup) : ""} Integration. Check they are correct before saving.`}
          confirmLabel="Save"
          cancelLabel="Cancel"
          busy={saving}
          onConfirm={() => {
            if (confirmGroup) void saveGroup(confirmGroup);
          }}
          onClose={() => {
            if (!saving) setConfirmGroup(null);
          }}
        />
      </div>
    </main>
  );
}
