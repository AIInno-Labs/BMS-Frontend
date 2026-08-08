"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getQuotientIntegration,
  updateQuotientIntegration,
  regenerateQuotientWebhookToken,
  listIntegrationApiKeys,
  issueIntegrationApiKey,
  revokeIntegrationApiKey,
} from "@/lib/frp/api";
import type {
  IntegrationApiKeyDTO,
  QuotientIntegrationDTO,
} from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const PROVIDER = "quotient";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";
const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

function errText(err: unknown, fallback: string): string {
  if (err instanceof FrpApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function QuotientIntegrationCard() {
  const [cfg, setCfg] = useState<QuotientIntegrationDTO | null>(null);
  const [keys, setKeys] = useState<IntegrationApiKeyDTO[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [triggers, setTriggers] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeKey = keys.find((k) => k.active);

  const applyCfg = useCallback((next: QuotientIntegrationDTO) => {
    setCfg(next);
    setBaseUrl(next.baseUrl ?? "");
    setTriggers(next.jobTriggerEvents ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [config, keyList] = await Promise.all([
        getQuotientIntegration(),
        listIntegrationApiKeys(PROVIDER),
      ]);
      applyCfg(config);
      setKeys(keyList);
    } catch (err) {
      setError(errText(err, "Failed to load Quotient integration"));
    } finally {
      setLoading(false);
    }
  }, [applyCfg]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, fn: () => Promise<void>, ok?: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage(ok);
    } catch (err) {
      setError(errText(err, "Request failed"));
    } finally {
      setBusy(null);
    }
  }

  const toggleEnabled = (enabled: boolean) =>
    run(
      "enable",
      async () => {
        const next = await updateQuotientIntegration({ enabled });
        applyCfg(next);
      },
      enabled ? "Quotient enabled — webhook token ready." : "Quotient disabled."
    );

  const saveSettings = () =>
    run(
      "settings",
      async () => {
        const next = await updateQuotientIntegration({
          baseUrl,
          jobTriggerEvents: triggers,
        });
        applyCfg(next);
      },
      "Settings saved."
    );

  const rotateToken = () =>
    run(
      "rotate",
      async () => {
        const next = await regenerateQuotientWebhookToken();
        applyCfg(next);
      },
      "New webhook token generated — re-paste the URL into Quotient."
    );

  const saveKey = () =>
    run(
      "key",
      async () => {
        await issueIntegrationApiKey(PROVIDER, {
          apiKey: newKey.trim(),
          expiresAt: newKeyExpiry ? new Date(newKeyExpiry).toISOString() : null,
        });
        setNewKey("");
        setNewKeyExpiry("");
        setKeys(await listIntegrationApiKeys(PROVIDER));
      },
      "API key saved. The previous key was revoked."
    );

  const revokeKey = (id: number) =>
    run(
      `revoke-${id}`,
      async () => {
        await revokeIntegrationApiKey(PROVIDER, id);
        setKeys(await listIntegrationApiKeys(PROVIDER));
      },
      "API key revoked."
    );

  async function copyUrl() {
    if (!cfg?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(cfg.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the field is selectable as a fallback */
    }
  }

  const enabled = !!cfg?.enabled;

  return (
    <section className="app-card mt-6 space-y-5 !p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Quotient</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Turn on the integration to receive quote webhooks and raise jobs.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#2563EB]"
            checked={enabled}
            disabled={loading || busy === "enable"}
            onChange={(e) => void toggleEnabled(e.target.checked)}
          />
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {/* Webhook URL — shown once enabled and a token exists */}
          {enabled && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <span className={labelClass}>Webhook URL</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    cfg?.webhookConfigured
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {cfg?.webhookConfigured ? "Armed" : "Not configured"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Paste this into Quotient → Account Settings → Webhooks.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  className={`${inputClass} font-mono text-xs`}
                  value={cfg?.webhookUrl ?? ""}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => void copyUrl()}
                  disabled={!cfg?.webhookUrl}
                  className="btn-secondary shrink-0 disabled:opacity-60"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void rotateToken()}
                disabled={busy === "rotate"}
                className="mt-3 text-xs font-semibold text-[#2563EB] hover:underline disabled:opacity-60"
              >
                {busy === "rotate" ? "Generating…" : "Generate new token"}
              </button>
              <span className="ml-2 text-xs text-slate-400">
                rotating invalidates the current URL until you re-paste it
              </span>
            </div>
          )}

          {/* Base URL + trigger events */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="quotient-base-url">
                Base URL
              </label>
              <input
                id="quotient-base-url"
                className={inputClass}
                value={baseUrl}
                placeholder="https://quotientapp.com"
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="quotient-triggers">
                Job trigger events
              </label>
              <input
                id="quotient-triggers"
                className={inputClass}
                value={triggers}
                placeholder="quote_accepted"
                onChange={(e) => setTriggers(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={busy === "settings"}
            className="btn-primary disabled:opacity-60"
          >
            {busy === "settings" ? "Saving…" : "Save settings"}
          </button>

          {/* API key */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-semibold text-[#111827]">API key</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              The Quotient-issued key used to call their API. Stored securely;
              only the last 4 characters are shown.
            </p>

            {activeKey ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="text-sm">
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {activeKey.maskedKey}
                  </span>
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Active
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Added {fmt(activeKey.createdAt)}
                    {activeKey.expiresAt ? ` · expires ${fmt(activeKey.expiresAt)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => activeKey.id != null && void revokeKey(activeKey.id)}
                  disabled={busy === `revoke-${activeKey.id}`}
                  className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                >
                  {busy === `revoke-${activeKey.id}` ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No active API key.</p>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label className={labelClass} htmlFor="quotient-new-key">
                  {activeKey ? "Replace key" : "Add key"}
                </label>
                <input
                  id="quotient-new-key"
                  type="password"
                  autoComplete="off"
                  className={inputClass}
                  value={newKey}
                  placeholder="Paste Quotient API key"
                  onChange={(e) => setNewKey(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="quotient-key-expiry">
                  Expiry (optional)
                </label>
                <input
                  id="quotient-key-expiry"
                  type="date"
                  className={inputClass}
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => void saveKey()}
                disabled={busy === "key" || newKey.trim() === ""}
                className="btn-primary disabled:opacity-60"
              >
                {busy === "key" ? "Saving…" : "Save key"}
              </button>
            </div>

            {/* Revoked history */}
            {keys.some((k) => !k.active) && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                  Key history ({keys.filter((k) => !k.active).length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {keys
                    .filter((k) => !k.active)
                    .map((k) => (
                      <li
                        key={k.id}
                        className="flex justify-between text-xs text-slate-500"
                      >
                        <span className="font-mono">{k.maskedKey}</span>
                        <span>
                          added {fmt(k.createdAt)} · revoked {fmt(k.revokedAt)}
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        </>
      )}
    </section>
  );
}
