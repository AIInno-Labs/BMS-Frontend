"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Shield, Wrench, X } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SearchBar } from "@/components/administration/ui/SearchBar";
import { FilterChips } from "@/components/administration/ui/FilterDropdown";
import { Avatar } from "@/components/administration/ui/Avatar";
import { RoleChip } from "@/components/administration/ui/RoleChip";
import {
  assignRoleToUser,
  getAssignableRoles,
  getRoleMappingUsers,
  removeAssignedRole,
} from "@/services/administration/roleMapping.service";
import type { RoleMappingUser } from "@/lib/administration/types";

const CATEGORIES = ["All Users", "Engineering", "Operations", "Admins"] as const;

const ROLE_ICONS: Record<RoleMappingUser["assignedRoles"][number]["icon"], typeof Shield> = {
  shield: Shield,
  wrench: Wrench,
  eye: Eye,
};

const SCOPE_STYLES: Record<
  RoleMappingUser["effectivePermissions"][number]["scope"],
  { bar: string; width: string; text: string }
> = {
  full: { bar: "bg-emerald-500", width: "100%", text: "text-emerald-600" },
  manage: { bar: "bg-[#F97316]", width: "65%", text: "text-[#F97316]" },
  none: { bar: "bg-slate-200", width: "6%", text: "text-slate-400" },
};

export function UserRoleMappingPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All Users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<RoleMappingUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState("");

  useEffect(() => {
    getRoleMappingUsers().then((u) => {
      setUsers(u);
      setSelectedId((prev) => prev ?? u[1]?.id ?? u[0]?.id ?? null);
    });
    getAssignableRoles().then(setAssignableRoles);
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (category !== "All Users" && u.category !== category) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    });
  }, [users, category, query]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  const suggestedRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    const assigned = new Set(selected?.assignedRoles.map((r) => r.name) ?? []);
    return assignableRoles.filter(
      (r) => !assigned.has(r) && (!q || r.toLowerCase().includes(q))
    );
  }, [assignableRoles, roleSearch, selected]);

  async function handleRemove(roleId: string) {
    if (!selected) return;
    const updated = await removeAssignedRole(selected.id, roleId);
    if (updated) setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  async function handleAssign(roleName: string) {
    if (!selected) return;
    const updated = await assignRoleToUser(selected.id, roleName);
    if (updated) {
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setRoleSearch("");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="User Access"
        subtitle="Manage roles and verify effective permissions across the organization."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search users by name, email, or department…"
            className="mb-3"
          />
          <div className="mb-3">
            <FilterChips value={category} options={CATEGORIES} onChange={(v) => setCategory(v as (typeof CATEGORIES)[number])} />
          </div>

          <div className="space-y-2">
            {filteredUsers.map((u) => {
              const active = u.id === selectedId;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? "border-orange-300 bg-orange-50/60"
                      : "border-slate-200 bg-white hover:border-orange-200"
                  }`}
                >
                  <Avatar
                    initials={u.avatarInitials}
                    colorClassName={u.avatarColor}
                    online={u.online}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#111827]">
                      {u.fullName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{u.email}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {u.roleNames.map((r) => (
                        <RoleChip key={r} label={r} />
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selected ? (
          <div className="app-card">
            <div className="mb-5 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#111827]">{selected.fullName}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {selected.department} · {selected.email}
              </p>
            </div>

            <div className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned Roles
              </h3>
              <div className="space-y-2">
                {selected.assignedRoles.map((role) => {
                  const Icon = ROLE_ICONS[role.icon];
                  return (
                    <div
                      key={role.id}
                      className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#111827]">
                          {role.name}
                        </span>
                        <span className="block text-xs text-slate-500">{role.description}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRemove(role.id)}
                        className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        aria-label={`Remove ${role.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign New Role
              </h3>
              <div className="relative">
                <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search roles to add…"
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
                />
                {roleSearch && suggestedRoles.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                    {suggestedRoles.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => void handleAssign(r)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-orange-50"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Effective Permissions
              </h3>
              <div className="space-y-4">
                {selected.effectivePermissions.map((row) => {
                  const style = SCOPE_STYLES[row.scope];
                  return (
                    <div key={row.module}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#111827]">{row.module}</span>
                        <span className={`text-xs font-semibold ${style.text}`}>{row.scopeLabel}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${style.bar}`} style={{ width: style.width }} />
                      </div>
                      {row.actions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                          {row.actions.map((a) => (
                            <span
                              key={a.label}
                              className={`inline-flex items-center gap-1 ${
                                a.granted ? "text-slate-600" : "text-slate-300 line-through"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  a.granted ? "bg-emerald-500" : "bg-slate-300"
                                }`}
                              />
                              {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" className="btn-ghost">
                Cancel
              </button>
              <button type="button" className="btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="app-card flex items-center justify-center text-sm text-slate-500">
            Select a user to view role assignments.
          </div>
        )}
      </div>
    </div>
  );
}
