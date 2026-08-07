"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, RefreshCw } from "lucide-react";
import { CreateOrganizationDrawer } from "@/components/admin/CreateOrganizationDrawer";
import { EditOrganizationDrawer } from "@/components/admin/EditOrganizationDrawer";
import { useAuth } from "@/context/AuthContext";
import { listOrganizations } from "@/lib/frp/api";
import type { OrganizationDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

export function OrganizationsAdminPage() {
  const {
    loading: authLoading,
    isAuthenticated,
    canManageOrganizations,
    appRole,
  } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrganizationDTO[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrganizationDTO | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole === "orgadmin") {
      router.replace("/org");
      return;
    }
    if (!canManageOrganizations) {
      setError("Your account does not have organization privileges.");
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, canManageOrganizations, appRole, router]);

  const load = useCallback(async () => {
    if (!isAuthenticated || !canManageOrganizations) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listOrganizations(page, 20);
      setOrgs(res.content ?? []);
      setTotalPages(res.totalPages ?? 0);
      setTotalElements(res.totalElements ?? 0);
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load organizations"
      );
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, canManageOrganizations, page]);

  const lastLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${isAuthenticated}:${canManageOrganizations}:${page}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;
    void load();
  }, [load, isAuthenticated, canManageOrganizations, page]);

  if (authLoading) {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading session…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
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
              Organizations
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              View tenants and provision new organizations with an org admin.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm sm:gap-2 sm:px-8 sm:py-4 sm:text-base"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-sm sm:gap-2 sm:px-8 sm:py-4 sm:text-base"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create organization
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            {!canManageOrganizations && (
              <Link href="/login" className="font-semibold underline">
                Sign in
              </Link>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#F8FAFC] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Loading organizations…
                    </td>
                  </tr>
                )}
                {!loading && orgs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Building2 className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        No organizations yet
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Create the first tenant to get started.
                      </p>
                    </td>
                  </tr>
                )}
                {!loading &&
                  orgs.map((org, idx) => (
                    <tr
                      key={org.id ?? org.companyCode ?? idx}
                      className={`border-t border-slate-100 transition-colors hover:bg-orange-50/35 ${
                        idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {org.companyCode ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {org.companyName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{org.city ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {org.country ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{org.email ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {org.phone ?? org.mobileNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-nowrap gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50"
                            onClick={() => setEditOrg(org)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {org.id != null && (
                            <Link
                              href={`/admin/parameters?organizationId=${org.id}`}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50"
                            >
                              Parameters
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span>
                {totalElements} total · page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary disabled:opacity-50"
                  disabled={page <= 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary disabled:opacity-50"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateOrganizationDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          if (page === 0) void load();
          else setPage(0);
        }}
      />
      <EditOrganizationDrawer
        open={Boolean(editOrg)}
        organization={editOrg}
        onClose={() => setEditOrg(null)}
        onUpdated={() => void load()}
      />
    </main>
  );
}
