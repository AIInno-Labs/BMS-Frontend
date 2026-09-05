"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RefreshCw, UserX, Users } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { useAuth } from "@/context/AuthContext";
import {
  createUser,
  disableUser,
  listRoles,
  listUsers,
  updateUser,
} from "@/lib/frp/api";
import type { RoleDTO, UserDTO } from "@/lib/frp/types";
import { LoadingState, SkeletonRows } from "@/components/ui/Loading";
import { FrpApiError } from "@/lib/frp/types";
import { CreateUserSchema, EditUserSchema } from "@/lib/schemas/user";
import { fieldErrorsFrom } from "@/lib/schemas/shared";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export function UsersAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole, user: me } =
    useAuth();
  const router = useRouter();
  const canManage =
    appRole === "orgadmin" ||
    (me?.rolesPrivileges ?? []).includes("USER_CREATE") ||
    (me?.rolesPrivileges ?? []).includes("USER_READ");

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDTO | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole === "superadmin") {
      router.replace("/admin");
      return;
    }
    if (!canManage) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, appRole, canManage, router]);

  const load = useCallback(async () => {
    if (!isAuthenticated || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        listUsers(page, 20),
        listRoles(0, 100),
      ]);
      setUsers(usersRes.content ?? []);
      setTotalPages(usersRes.totalPages ?? 0);
      setRoles(rolesRes.content ?? []);
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load users"
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, canManage, page]);

  const lastLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading || !isAuthenticated || !canManage || me?.id == null) return;
    const key = `${me.id}:${page}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;
    void load();
  }, [authLoading, isAuthenticated, canManage, me?.id, page, load]);

  async function onDisable(u: UserDTO) {
    if (u.id == null) return;
    if (!window.confirm(`Disable ${u.email}?`)) return;
    setError(null);
    try {
      await disableUser(u.id);
      await load();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Disable failed"
      );
    }
  }

  if (authLoading || !canManage) {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <LoadingState />
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Organization Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">Users</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create users and assign organization roles. Users can enroll
              authenticator when MFA is enabled for this org.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create user
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="scrollbar-thin app-card mt-6 overflow-x-auto !p-0">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">MFA</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows columns={6} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      No users yet. Create one to get started.
                    </span>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.displayName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(u.roleCodes ?? []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.enabled === false ? "Disabled" : "Active"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.totpEnabled ? "Enrolled" : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-nowrap gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-orange-50"
                          onClick={() => setEditUser(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {u.enabled !== false && u.id !== me?.id && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            onClick={() => void onDisable(u)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Disable
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary disabled:opacity-50"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary disabled:opacity-50"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <CreateUserDrawer
        open={createOpen}
        roles={roles}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />
      <EditUserDrawer
        open={Boolean(editUser)}
        user={editUser}
        roles={roles}
        onClose={() => setEditUser(null)}
        onSaved={() => {
          setEditUser(null);
          void load();
        }}
      />
    </main>
  );
}

function CreateUserDrawer({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean;
  roles: RoleDTO[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setPassword("");
    setDisplayName("");
    setMobileNumber("");
    setRoleIds([]);
    setError(null);
    setFieldErrors({});
  }, [open]);

  function toggleRole(id: number) {
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = CreateUserSchema.safeParse({
      email,
      password,
      displayName,
      mobileNumber,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSaving(true);
    try {
      const data = parsed.data;
      await createUser({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        mobileNumber: data.mobileNumber || undefined,
        roleIds,
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Create failed"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EnterpriseDrawer open={open} onClose={onClose} title="Create user">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="cu-email">
            Email
          </label>
          <input
            id="cu-email"
            type="email"
            className={inputClass}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="cu-name">
            Display name
          </label>
          <input
            id="cu-name"
            className={inputClass}
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          {fieldErrors.displayName && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.displayName}</p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="cu-pass">
            Password
          </label>
          <input
            id="cu-pass"
            type="password"
            className={inputClass}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="cu-mobile">
            Mobile
          </label>
          <input
            id="cu-mobile"
            className={inputClass}
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
          />
          {fieldErrors.mobileNumber && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.mobileNumber}</p>
          )}
        </div>
        <fieldset>
          <legend className={labelClass}>Roles</legend>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {roles.length === 0 ? (
              <p className="text-sm text-slate-500">
                Create a role first under Roles.
              </p>
            ) : (
              roles.map((r) =>
                r.id == null ? null : (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={roleIds.includes(r.id)}
                      onChange={() => toggleRole(r.id!)}
                    />
                    {r.role} ({r.roleCode})
                  </label>
                )
              )
            )}
          </div>
        </fieldset>
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || roleIds.length === 0}
          className="btn-primary w-full disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create user"}
        </button>
      </form>
    </EnterpriseDrawer>
  );
}

function EditUserDrawer({
  open,
  user,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserDTO | null;
  roles: RoleDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setDisplayName(user.displayName ?? "");
    setMobileNumber(user.mobileNumber ?? "");
    setEnabled(user.enabled !== false);
    setPassword("");
    setRoleIds(user.roleIds ?? []);
    setError(null);
    setFieldErrors({});
  }, [open, user]);

  function toggleRole(id: number) {
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    setError(null);
    setFieldErrors({});

    const parsed = EditUserSchema.safeParse({ displayName, mobileNumber, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSaving(true);
    try {
      const data = parsed.data;
      await updateUser({
        id: user.id,
        displayName: data.displayName,
        mobileNumber: data.mobileNumber || undefined,
        enabled,
        roleIds,
        password: data.password || undefined,
      });
      onSaved();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Update failed"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <EnterpriseDrawer
      open={open}
      onClose={onClose}
      title={user ? `Edit ${user.email}` : "Edit user"}
    >
      {user && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="eu-name">
              Display name
            </label>
            <input
              id="eu-name"
              className={inputClass}
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {fieldErrors.displayName && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.displayName}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="eu-mobile">
              Mobile
            </label>
            <input
              id="eu-mobile"
              className={inputClass}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
            />
            {fieldErrors.mobileNumber && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.mobileNumber}</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="eu-pass">
              New password (optional)
            </label>
            <input
              id="eu-pass"
              type="password"
              className={inputClass}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Account enabled
          </label>
          <fieldset>
            <legend className={labelClass}>Roles</legend>
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {roles.map((r) =>
                r.id == null ? null : (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={roleIds.includes(r.id)}
                      onChange={() => toggleRole(r.id!)}
                    />
                    {r.role} ({r.roleCode})
                  </label>
                )
              )}
            </div>
          </fieldset>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving || roleIds.length === 0}
            className="btn-primary w-full disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </EnterpriseDrawer>
  );
}
