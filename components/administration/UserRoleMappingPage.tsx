"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Eye, Headset, Plus, Shield, Wrench, X } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
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
import type { AssignableRole, RoleIcon, RoleMappingUser } from "@/lib/administration/types";

const CATEGORIES = ["All Users", "Engineering", "Operations", "Admins"] as const;

const ROLE_ICONS: Record<RoleIcon, typeof Shield> = {
  shield: Shield,
  briefcase: Briefcase,
  wrench: Wrench,
  eye: Eye,
  headset: Headset,
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
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [roleSearch, setRoleSearch] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRoleMappingUsers().then(setUsers);
    getAssignableRoles().then(setAssignableRoles);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      (r) => !assigned.has(r.name) && (!q || r.name.toLowerCase().includes(q))
    );
  }, [assignableRoles, roleSearch, selected]);

  async function handleRemove(roleId: string) {
    if (!selected) return;
    const updated = await removeAssignedRole(selected.id, roleId);
    if (updated) setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  async function handleAssign(role: AssignableRole) {
    if (!selected) return;
    const updated = await assignRoleToUser(selected.id, role);
    if (updated) {
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setRoleSearch("");
      setRoleDropdownOpen(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="User Access"
        subtitle="Manage roles and verify effective permissions across the organization."
      />

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search users by name, email, or department…"
        className="mb-3"
      />
      <div className="mb-3">
        <FilterChips value={category} options={CATEGORIES} onChange={(v) => setCategory(v as (typeof CATEGORIES)[number])} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((u) => {
          const active = u.id === selectedId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelectedId(u.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
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

      <EnterpriseDrawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.fullName ?? ""}
        subtitle={selected ? `${selected.department} · ${selected.email}` : undefined}
        panelClassName="md:w-[44%] md:max-w-[560px]"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSelectedId(null)} className="btn-ghost">
              Cancel
            </button>
            <button type="button" onClick={() => setSelectedId(null)} className="btn-primary">
              Save Changes
            </button>
          </div>
        }
      >
        {selected && (
          <div className="p-5 sm:p-6">
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

            <div className="mb-5" ref={roleDropdownRef}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign New Role
              </h3>
              <div className="relative">
                <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  onFocus={() => setRoleDropdownOpen(true)}
                  placeholder="Search roles to add…"
                  className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
                />
                {roleDropdownOpen && (
                  <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {suggestedRoles.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-400">
                        {roleSearch ? "No matching roles." : "All roles are already assigned."}
                      </p>
                    ) : (
                      suggestedRoles.map((r) => {
                        const Icon = ROLE_ICONS[r.icon];
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => void handleAssign(r)}
                            className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-orange-50"
                          >
                            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[#111827]">
                                {r.name}
                              </span>
                              <span className="block text-xs text-slate-500">{r.description}</span>
                            </span>
                          </button>
                        );
                      })
                    )}
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
          </div>
        )}
      </EnterpriseDrawer>
    </div>
  );
}
