"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

function isSecretParam(name: string) {
  return SECRET_SUFFIXES.some((s) => name.endsWith(s));
}

function isGeneratedParam(name: string) {
  return GENERATED_PARAMS.has(name);
}

function groupOf(name: string): "SharePoint" | "Quotient" | "LLM" | "Other" {
  if (name.startsWith("SHAREPOINT_")) return "SharePoint";
  if (name.startsWith("QUOTIENT_")) return "Quotient";
  if (name.startsWith("LLM_")) return "LLM";
  return "Other";
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        next[p.paramName] = isSecretParam(p.paramName) ? "" : (p.paramValue ?? "");
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
    const map: Record<string, ApplicationParameterDTO[]> = {
      SharePoint: [],
      Quotient: [],
      LLM: [],
      Other: [],
    };
    for (const p of params) {
      map[groupOf(p.paramName)].push(p);
    }
    return map;
  }, [params]);

  async function onSaveGroup(
    e: FormEvent,
    group: "SharePoint" | "Quotient" | "LLM" | "Other"
  ) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const rows = grouped[group];
      for (const row of rows) {
        const nextVal = values[row.paramName] ?? "";
        if (isSecretParam(row.paramName) && nextVal === "") {
          continue;
        }
        const current = row.paramValue ?? "";
        if (nextVal === current && !isSecretParam(row.paramName)) {
          continue;
        }
        await upsertOrgParameter({
          id: row.inherited ? undefined : row.id ?? undefined,
          paramName: row.paramName,
          paramValue: nextVal,
          paramType: row.paramType ?? "String",
        });
      }
      setMessage(`${group} settings saved.`);
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
          SharePoint and Quotient connection settings for your organization.
          Only parameters marked org-editable by Super Admin appear here.
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
          (["SharePoint", "Quotient", "LLM", "Other"] as const).map((group) => {
            const rows = grouped[group];
            if (rows.length === 0) return null;
            return (
              <form
                key={group}
                onSubmit={(e) => void onSaveGroup(e, group)}
                className="app-card mt-6 space-y-4 !p-5"
              >
                <h3 className="text-sm font-semibold text-[#111827]">{group}</h3>
                {rows.map((row) => {
                  const booleanType =
                    (row.paramType ?? "").toLowerCase() === "boolean";
                  const secret = isSecretParam(row.paramName);
                  const generated = isGeneratedParam(row.paramName);
                  return (
                    <div key={row.paramName}>
                      <label className={labelClass} htmlFor={row.paramName}>
                        {row.paramName}
                        {row.inherited ? " (using platform default)" : ""}
                        {secret ? " — leave blank to keep" : ""}
                        {generated ? " — generated, read-only" : ""}
                      </label>
                      {row.description ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.description}
                        </p>
                      ) : null}
                      {generated ? (
                        <div className="mt-1.5 flex gap-2">
                          <input
                            id={row.paramName}
                            readOnly
                            className={`${inputClass} !mt-0 min-w-0 flex-1 bg-slate-50 font-mono text-xs text-slate-600`}
                            value={values[row.paramName] ?? ""}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="Generate a token to fill this"
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
                      ) : (
                        <input
                          id={row.paramName}
                          type={secret ? "password" : "text"}
                          className={inputClass}
                          value={values[row.paramName] ?? ""}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [row.paramName]: e.target.value,
                            }))
                          }
                          autoComplete="off"
                          placeholder={
                            secret && row.paramValue ? "••••••••" : undefined
                          }
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
                  {saving ? "Saving…" : `Save ${group}`}
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
      </div>
    </main>
  );
}
