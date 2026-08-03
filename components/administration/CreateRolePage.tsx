"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { ToggleSwitch } from "@/components/administration/ui/ToggleSwitch";
import {
  createRole,
  getDefaultCreateRolePayload,
} from "@/services/administration/role.service";
import type { CreateRolePayload, PermissionAction } from "@/lib/administration/types";

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
  { key: "export", label: "Export" },
];

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

export function CreateRolePage() {
  const router = useRouter();
  const [payload, setPayload] = useState<CreateRolePayload | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDefaultCreateRolePayload().then((p) =>
      setPayload({ ...p, permissions: p.permissions.map((g) => ({ ...g, actions: { ...g.actions } })) })
    );
  }, []);

  if (!payload) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  function toggleAction(moduleIndex: number, action: PermissionAction) {
    setPayload((prev) => {
      if (!prev) return prev;
      const permissions = prev.permissions.map((g, i) =>
        i === moduleIndex
          ? { ...g, actions: { ...g.actions, [action]: !g.actions[action] } }
          : g
      );
      return { ...prev, permissions };
    });
    setDirty(true);
  }

  function update<K extends keyof CreateRolePayload>(key: K, value: CreateRolePayload[K]) {
    setPayload((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }

  async function handleSave() {
    if (!payload || !payload.name.trim()) return;
    setSaving(true);
    await createRole(payload);
    setSaving(false);
    setDirty(false);
    router.push("/administration/roles");
  }

  async function handleDiscard() {
    const fresh = await getDefaultCreateRolePayload();
    setPayload({ ...fresh, permissions: fresh.permissions.map((g) => ({ ...g, actions: { ...g.actions } })) });
    setDirty(false);
  }

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <PageHeader
        title="Create Role"
        subtitle="Define capabilities and access levels for this new role."
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/administration/roles")}
              className="text-sm font-semibold text-[#F97316] hover:text-orange-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!payload.name.trim() || saving}
              onClick={() => void handleSave()}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Role"}
            </button>
          </>
        }
      />

      <div className="app-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role Name *
            </label>
            <input
              className={inputClass}
              placeholder="e.g., Senior Technician"
              value={payload.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <input
              className={inputClass}
              placeholder="Brief description of this role's purpose…"
              value={payload.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <ToggleSwitch
            checked={payload.isSystemAdmin}
            onChange={(v) => update("isSystemAdmin", v)}
            label="System Administrator Privileges"
            description="Grants full access across all modules automatically."
          />
        </div>
      </div>

      <div className="app-card mt-6 !p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4">
          <h3 className="text-base font-semibold text-[#111827]">Permission Mapping</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="px-3 py-3 text-center">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.permissions.map((group, idx) => (
                <tr key={group.module} className="border-b border-slate-50 last:border-0">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#111827]">{group.module}</p>
                    <p className="text-xs text-slate-500">{group.description}</p>
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a.key} className="px-3 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={payload.isSystemAdmin || group.actions[a.key]}
                        disabled={payload.isSystemAdmin}
                        onChange={() => toggleAction(idx, a.key)}
                        className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-orange-300 disabled:opacity-60"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white px-6 py-3 shadow-[0_-8px_22px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-sm text-slate-600">Unsaved changes in permission mapping</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => void handleDiscard()} className="btn-ghost">
                Discard
              </button>
              <button
                type="button"
                disabled={!payload.name.trim() || saving}
                onClick={() => void handleSave()}
                className="btn-primary disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
