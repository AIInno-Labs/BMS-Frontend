"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Settings2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function SuperAdminDashboard() {
  const { user, loading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "superadmin") {
      router.replace(appRole === "orgadmin" ? "/org" : "/");
    }
  }, [loading, isAuthenticated, appRole, router]);

  if (loading || !isAuthenticated || appRole !== "superadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Super Admin
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#111827]">
          Platform dashboard
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}. Manage
          organizations across the platform.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/organizations"
            className="app-card-interactive block !p-5"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">
                  Organizations
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Create, view, and update tenant organizations and their admins.
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/privileges"
            className="app-card-interactive block !p-5"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">
                  Privileges
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Catalog: ACTION / MENU / FIELD. Create and edit MENU / FIELD
                  only (ACTION is system-managed).
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/admin/parameters"
            className="app-card-interactive block !p-5"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Settings2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">
                  Parameters
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Platform and per-organization settings such as MFA_TOTP_ENABLED.
                </p>
              </div>
            </div>
          </Link>
          <div className="app-card !p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">
                  Platform scope
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  You are signed in without an organization — full platform
                  privileges apply.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
