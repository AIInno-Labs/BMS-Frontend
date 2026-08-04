"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Headset, Pencil, Plus, Shield, ShieldCheck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/administration/ui/DataTable";
import { StatusPill } from "@/components/administration/ui/StatusPill";
import { getRoles } from "@/services/administration/role.service";
import type { Role } from "@/lib/administration/types";

const ROLE_ICONS: Record<Role["icon"], typeof Shield> = {
  shield: ShieldCheck,
  briefcase: Shield,
  wrench: Wrench,
  eye: Eye,
  headset: Headset,
};

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRoles().then((r) => {
      setRoles(r);
      setLoading(false);
    });
  }, []);

  const columns: DataTableColumn<Role>[] = [
    {
      key: "name",
      header: "Role Name",
      render: (r) => {
        const Icon = ROLE_ICONS[r.icon];
        return (
          <span className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-semibold text-[#111827]">{r.name}</span>
          </span>
        );
      },
    },
    { key: "description", header: "Description", render: (r) => <span className="text-slate-600">{r.description}</span> },
    { key: "users", header: "Users", render: (r) => r.usersCount },
    { key: "permissions", header: "Permissions", render: (r) => r.permissionsCount },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusPill label={r.status === "active" ? "Active" : "Inactive"} tone={r.status === "active" ? "success" : "neutral"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <Link
          href={`/administration/roles/${r.id}/edit`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Roles"
        subtitle="Manage user roles and system permissions."
        actions={
          <Link href="/administration/roles/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Role
          </Link>
        }
      />

      <DataTable
        columns={columns}
        rows={roles}
        rowKey={(r) => r.id}
        loading={loading}
        emptyMessage="No roles yet."
      />

      <p className="mt-3 text-sm text-slate-500">Showing {roles.length} of {roles.length} roles</p>
    </div>
  );
}
