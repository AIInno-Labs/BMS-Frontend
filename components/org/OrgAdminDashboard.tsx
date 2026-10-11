"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plug, Shield, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function OrgAdminDashboard() {
  const { user, loading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();
  const orgName = user?.organization?.companyName;

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "orgadmin") {
      router.replace(appRole === "superadmin" ? "/admin" : "/");
    }
  }, [loading, isAuthenticated, appRole, router]);

  if (loading || !isAuthenticated || appRole !== "orgadmin") {
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
          Organization Admin
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[#111827]">
          {orgName ? `${orgName} admin` : "Organization dashboard"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage roles and access for your organization. Fabrication workspace
          stays available to org users.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/org/users" className="app-card-interactive block !p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">Users</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Create users and assign organization roles.
                </p>
              </div>
            </div>
          </Link>
          <Link href="/org/roles" className="app-card-interactive block !p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">Roles</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Create and assign privileges to organization roles.
                </p>
              </div>
            </div>
          </Link>
          <Link
            href="/org/integrations"
            className="app-card-interactive block !p-5"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Plug className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">
                  Integrations
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  SharePoint and Quotient connection settings for this org.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
