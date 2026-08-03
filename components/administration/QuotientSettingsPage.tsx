"use client";

import { useEffect, useState } from "react";
import { Info, Link2, Plug } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SettingsCard, FormField } from "@/components/administration/ui/SettingsCard";
import { SecretInput } from "@/components/administration/ui/SecretInput";
import { StatusPill } from "@/components/administration/ui/StatusPill";
import { InfoCard, InfoCardRow } from "@/components/administration/ui/InfoCard";
import {
  getQuotientConfig,
  saveQuotientConfig,
  testQuotientConnection,
} from "@/services/administration/settings.service";
import type { QuotientConfig } from "@/lib/administration/types";

const inputClass =
  "w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

export function QuotientSettingsPage() {
  const [config, setConfig] = useState<QuotientConfig | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getQuotientConfig().then(setConfig);
  }, []);

  if (!config) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  async function handleTest() {
    const res = await testQuotientConnection();
    setTestResult(res.message);
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    const saved = await saveQuotientConfig(config);
    setConfig(saved);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Quotient Integration"
        subtitle="Configure and manage connection to Quotient API"
        actions={
          <StatusPill label={config.connected ? "Connected" : "Disconnected"} tone={config.connected ? "success" : "danger"} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <SettingsCard icon={Plug} title="API Credentials">
            <FormField label="API Base URL">
              <input
                className={inputClass}
                value={config.apiBaseUrl}
                onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
              />
            </FormField>
            <FormField label="API Key" hint="Used to authenticate requests to Quotient.">
              <SecretInput
                value={config.apiKey}
                onChange={(v) => setConfig({ ...config, apiKey: v })}
              />
            </FormField>
          </SettingsCard>

          <SettingsCard icon={Link2} title="Webhook Configuration">
            <FormField label="Webhook Endpoint" hint="Copy this URL to Quotient webhook settings.">
              <SecretInput value={config.webhookEndpoint} readOnly showCopy />
            </FormField>
            <FormField label="Webhook Secret" hint="Used to verify incoming webhook payloads.">
              <SecretInput
                value={config.webhookSecret}
                onChange={(v) => setConfig({ ...config, webhookSecret: v })}
              />
            </FormField>
          </SettingsCard>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => void handleTest()} className="btn-secondary">
              Test Connection
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="btn-primary disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Configuration"}
            </button>
          </div>
          {testResult && <p className="text-right text-xs font-medium text-slate-600">{testResult}</p>}
        </div>

        <div className="space-y-6">
          <InfoCard title="Sync Status">
            <InfoCardRow label="Last Sync" value={config.lastSync ?? "Never"} />
            <InfoCardRow label="Quotes Synced" value={`${config.quotesSyncedTotal.toLocaleString()} Total`} />
            <InfoCardRow label="Pending Webhooks" value={`${config.pendingWebhooks} in queue`} />
          </InfoCard>

          <div className="app-card !p-5">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">Integration Notes</h3>
                <p className="mt-1.5 text-sm text-slate-500">
                  Ensure the Webhook URL is added to your Quotient account settings under
                  Integrations &gt; Webhooks. Selecting &quot;All Events&quot; is recommended for
                  complete data synchronization.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
