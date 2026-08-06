"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, RefreshCw, Shield } from "lucide-react";
import { CreateRoleDrawer } from "@/components/org/CreateRoleDrawer";
import { useAuth } from "@/context/AuthContext";
import { listRoles } from "@/lib/frp/api";
import type { RoleDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

export function RolesAdminPage() {
  const { loading: authLoading, isAuthenticated, canManageRoles, appRole } =
    useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDTO | null>(null);

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
    if (!canManageRoles && appRole !== "orgadmin") {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, canManageRoles, appRole, router]);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listRoles(0, 50);
      setRoles(res.content ?? []);
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load roles"
      );
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditRole(null);
    setDrawerOpen(true);
  }

  function openEdit(r: RoleDTO) {
    setEditRole(r);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditRole(null);
  }

  if (authLoading || !isAuthenticated) {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Organization Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">Roles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create and edit roles and privileges for users in your
              organization.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm sm:gap-2 sm:px-8 sm:py-4 sm:text-base"
              onClick={() => void load()}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm sm:gap-2 sm:px-8 sm:py-4 sm:text-base"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Create role
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Privileges</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Loading roles…
                  </td>
                </tr>
              )}
              {!loading && roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Shield className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      No roles yet
                    </p>
                  </td>
                </tr>
              )}
              {!loading &&
                roles.map((r, idx) => (
                  <tr
                    key={r.id ?? r.roleCode}
                    className={`border-t border-slate-100 ${
                      idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {r.role}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.roleCode}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {(r.privilegeCodes ?? []).length} assigned
                    </td>
                    <td className="px-4 py-3">
                      {r.roleCode !== "ORG_ADMIN" && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-orange-50"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateRoleDrawer
        open={drawerOpen}
        initialRole={editRole}
        onClose={closeDrawer}
        onSaved={() => {
          closeDrawer();
          void load();
        }}
      />
    </main>
  );
}
