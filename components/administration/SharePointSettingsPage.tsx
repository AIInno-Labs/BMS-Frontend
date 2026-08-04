"use client";

import { useEffect, useState } from "react";
import { FolderTree, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SettingsCard, FormField } from "@/components/administration/ui/SettingsCard";
import { SecretInput } from "@/components/administration/ui/SecretInput";
import { StatusPill } from "@/components/administration/ui/StatusPill";
import {
  getSharePointConfig,
  saveSharePointConfig,
  testSharePointConnection,
} from "@/services/administration/settings.service";
import type { SharePointConfig } from "@/lib/administration/types";

const inputClass =
  "w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

export function SharePointSettingsPage() {
  const [config, setConfig] = useState<SharePointConfig | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSharePointConfig().then(setConfig);
  }, []);

  if (!config) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  async function handleTest() {
    const res = await testSharePointConnection();
    setTestResult(res.message);
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    const saved = await saveSharePointConfig(config);
    setConfig(saved);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="SharePoint Integration"
        subtitle="Configure your Microsoft SharePoint tenant settings to enable document syncing and management within FRP Engineering."
        actions={
          <StatusPill label={config.connected ? "Connected" : "Disconnected"} tone={config.connected ? "success" : "danger"} />
        }
      />

      <div className="space-y-6">
        <SettingsCard icon={KeyRound} title="Authentication">
          <p className="-mt-2 text-sm text-slate-500">
            Provide the Azure AD App credentials used to access your SharePoint tenant.{" "}
            <a href="#" className="font-semibold text-[#F97316] hover:underline">
              Setup Guide
            </a>
          </p>
          <FormField label="Tenant ID">
            <input
              className={inputClass}
              value={config.tenantId}
              onChange={(e) => setConfig({ ...config, tenantId: e.target.value })}
            />
          </FormField>
          <FormField label="Client ID">
            <input
              className={inputClass}
              placeholder="Application (client) ID from Azure portal"
              value={config.clientId}
              onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            />
          </FormField>
          <FormField label="Client Secret" hint="This value is encrypted at rest.">
            <SecretInput
              value={config.clientSecret}
              placeholder="Client secret value"
              onChange={(v) => setConfig({ ...config, clientSecret: v })}
            />
          </FormField>
        </SettingsCard>

        <SettingsCard icon={FolderTree} title="Target Location">
          <p className="-mt-2 text-sm text-slate-500">
            Define where documents should be stored and managed within SharePoint.
          </p>
          <FormField label="Site URL">
            <input
              className={inputClass}
              placeholder="https://contoso.sharepoint.com/sites/operations"
              value={config.siteUrl}
              onChange={(e) => setConfig({ ...config, siteUrl: e.target.value })}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Document Library">
              <input
                className={inputClass}
                value={config.documentLibrary}
                onChange={(e) => setConfig({ ...config, documentLibrary: e.target.value })}
              />
            </FormField>
            <FormField label="Default Root Folder">
              <input
                className={inputClass}
                value={config.defaultRootFolder}
                onChange={(e) => setConfig({ ...config, defaultRootFolder: e.target.value })}
              />
            </FormField>
          </div>
        </SettingsCard>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            <span>Last synced: {config.lastSynced ?? "N/A"}</span>
            {testResult && <p className="mt-1 text-xs font-medium text-slate-600">{testResult}</p>}
          </div>
          <div className="flex gap-2">
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
        </div>
      </div>
    </div>
  );
}
