"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Contact,
  Eye,
  MapPin,
  Shield,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { ToggleSwitch } from "@/components/administration/ui/ToggleSwitch";
import {
  createUser,
  getDepartments,
  getUser,
  updateUserDetails,
} from "@/services/administration/user.service";
import { getRoles } from "@/services/administration/role.service";
import type { Role } from "@/lib/administration/types";

const SECTIONS = [
  { id: "general", label: "General Info", icon: Contact },
  { id: "account", label: "Account Setup", icon: Briefcase },
  { id: "role", label: "Role Assignment", icon: MapPin },
  { id: "status", label: "Status & Preferences", icon: UserCog },
] as const;

const ROLE_ICONS: Record<string, typeof Shield> = {
  "role-field-engineer": ShieldCheck,
  "role-operations-manager": UserCog,
  "role-org-admin": Shield,
  "role-guest-viewer": Eye,
};

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#F97316] focus:ring-2 focus:ring-orange-200/40";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function CreateUserPage({ userId }: { userId?: string } = {}) {
  const router = useRouter();
  const isEdit = Boolean(userId);
  const [departments, setDepartments] = useState<readonly string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [generatePassword, setGeneratePassword] = useState(true);
  const [roleId, setRoleId] = useState<string>("");
  const [accountActive, setAccountActive] = useState(true);
  const [requireMfa, setRequireMfa] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDepartments().then((d) => {
      setDepartments(d);
      if (!isEdit) setDepartment(d[0] ?? "");
    });
    getRoles().then((r) => {
      setRoles(r);
      if (!isEdit) setRoleId(r[0]?.id ?? "");
    });
  }, [isEdit]);

  useEffect(() => {
    if (!userId) return;
    getUser(userId).then((user) => {
      if (!user) {
        setNotFound(true);
        return;
      }
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setPhone(user.phone ?? "");
      setDepartment(user.department);
      setEmail(user.email);
      setRoleId(user.roleIds[0] ?? "");
      setAccountActive(user.status === "active");
      setLoaded(true);
    });
  }, [userId]);

  const canSave = useMemo(
    () => firstName.trim() && lastName.trim() && email.trim() && roleId,
    [firstName, lastName, email, roleId]
  );

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    if (userId) {
      await updateUserDetails(userId, {
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        department,
        roleId,
        accountActive,
      });
    } else {
      await createUser({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        department,
        generatePassword,
        roleId,
        accountActive,
        requireMfa,
      });
    }
    setSaving(false);
    router.push("/administration/users");
  }

  if (notFound) {
    return <p className="py-12 text-center text-sm text-slate-500">User not found.</p>;
  }

  if (!loaded) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isEdit ? "Edit User" : "Create New User"}
        subtitle={
          isEdit
            ? "Update this team member's details and access privileges."
            : "Add a new team member and assign their system access privileges."
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/administration/users")}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={() => void handleSave()}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Save User"}
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="hidden flex-col gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-orange-50/60 hover:text-orange-700"
            >
              <s.icon className="h-4 w-4" aria-hidden />
              {s.label}
            </a>
          ))}
        </nav>

        <div className="space-y-6">
          <section id="general" className="app-card scroll-mt-6">
            <h3 className="mb-4 text-base font-semibold text-[#111827]">General Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  className={inputClass}
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input
                  className={inputClass}
                  placeholder="Enter last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  className={inputClass}
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Department</label>
                <select
                  className={inputClass}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section id="account" className="app-card scroll-mt-6">
            <h3 className="mb-4 text-base font-semibold text-[#111827]">Account Setup</h3>
            <label className={labelClass}>Email Address (Login ID) *</label>
            <input
              type="email"
              className={inputClass}
              placeholder="user@frpengineering.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {isEdit ? (
              <button type="button" className="btn-ghost mt-4">
                Send Password Reset Email
              </button>
            ) : (
              <div className="mt-4">
                <ToggleSwitch
                  checked={generatePassword}
                  onChange={setGeneratePassword}
                  label="Generate Password Automatically"
                  description="System will email a secure setup link to the user."
                />
              </div>
            )}
          </section>

          <section id="role" className="app-card scroll-mt-6">
            <h3 className="mb-4 text-base font-semibold text-[#111827]">Role Assignment</h3>
            <p className="mb-3 text-sm text-slate-500">
              Select one or more roles to define system access levels.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map((r) => {
                const Icon = ROLE_ICONS[r.id] ?? Shield;
                const active = roleId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoleId(r.id)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? "border-orange-300 bg-orange-50/60"
                        : "border-slate-200 bg-white hover:border-orange-200"
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-sm border ${
                        active ? "border-orange-500 bg-orange-500" : "border-slate-300"
                      }`}
                    />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                        {r.name}
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{r.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section id="status" className="app-card scroll-mt-6">
            <h3 className="mb-4 text-base font-semibold text-[#111827]">Status &amp; Preferences</h3>
            <div className="space-y-3">
              <ToggleSwitch
                checked={accountActive}
                onChange={setAccountActive}
                label="Account Active"
                description="User can immediately log in upon creation."
              />
              <ToggleSwitch
                checked={requireMfa}
                onChange={setRequireMfa}
                label="Require MFA"
                description="Mandate multi-factor authentication on first login."
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
