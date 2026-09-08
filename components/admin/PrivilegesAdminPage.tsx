"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, RefreshCw } from "lucide-react";
import { CreatePrivilegeDrawer } from "@/components/admin/CreatePrivilegeDrawer";
import { EditPrivilegeDrawer } from "@/components/admin/EditPrivilegeDrawer";
import { useAuth } from "@/context/AuthContext";
import { listPrivileges } from "@/lib/frp/api";
import { PRIVILEGE_TYPES, type PrivilegeType } from "@/lib/frp/privilege-types";
import type { PrivilegeDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";
import { LoadingState, SkeletonRows } from "@/components/ui/Loading";

type TypeFilter = "ALL" | PrivilegeType;

export function PrivilegesAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PrivilegeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<PrivilegeDTO | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "superadmin") {
      router.replace(appRole === "orgadmin" ? "/org" : "/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  const load = useCallback(async () => {
    if (!isAuthenticated || appRole !== "superadmin") return;
    setLoading(true);
    setError(null);
    try {
      const list = await listPrivileges();
      setItems(list ?? []);
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to load privileges"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, appRole]);

  const lastLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${isAuthenticated}:${appRole}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;
    void load();
  }, [load, isAuthenticated, appRole]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (typeFilter !== "ALL" && p.privilegeType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.privilegeCode.toLowerCase().includes(q) ||
        (p.privilege ?? "").toLowerCase().includes(q) ||
        (p.domain ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, typeFilter, query]);

  if (authLoading || !isAuthenticated || appRole !== "superadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <LoadingState />
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Super Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">
              Privileges
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Catalog types: ACTION, MENU, FIELD. Create/edit MENU and FIELD
              only — ACTION codes are synced from the API and system-managed.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm sm:gap-2 sm:px-8 sm:py-4 sm:text-base"
              onClick={() => void load()}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm sm:gap-2 sm:px-8 sm:py-4 sm:text-base"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create privilege
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="min-h-[40px] w-full rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 sm:max-w-xs"
            placeholder="Search code, label, domain…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", ...PRIVILEGE_TYPES] as TypeFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  typeFilter === t
                    ? "bg-orange-50 text-orange-700"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonRows columns={6} />}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        No privileges match
                      </p>
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((p, idx) => {
                    const canEdit =
                      p.privilegeType !== "ACTION" && !p.systemManaged;
                    return (
                      <tr
                        key={p.id ?? p.privilegeCode}
                        className={`border-t border-slate-100 ${
                          idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {p.privilegeCode}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {p.privilege ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            {p.privilegeType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.domain ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.active === false ? "No" : "Yes"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={!canEdit}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => setEditItem(p)}
                            title={
                              canEdit
                                ? "Edit"
                                : "System ACTION privileges cannot be edited"
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreatePrivilegeDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
      <EditPrivilegeDrawer
        open={Boolean(editItem)}
        privilege={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={() => void load()}
      />
    </main>
  );
}
