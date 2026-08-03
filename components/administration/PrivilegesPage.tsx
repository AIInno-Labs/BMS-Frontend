"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SearchBar } from "@/components/administration/ui/SearchBar";
import { FilterChips } from "@/components/administration/ui/FilterDropdown";
import { DataTable, type DataTableColumn } from "@/components/administration/ui/DataTable";
import { StatusPill, type StatusPillTone } from "@/components/administration/ui/StatusPill";
import { RoleChip } from "@/components/administration/ui/RoleChip";
import {
  getPrivileges,
  getPrivilegeModules,
} from "@/services/administration/privilege.service";
import type { Privilege } from "@/lib/administration/types";

const STATUS_TONE: Record<Privilege["status"], StatusPillTone> = {
  active: "success",
  restricted: "danger",
  inactive: "neutral",
};

const STATUS_LABEL: Record<Privilege["status"], string> = {
  active: "Active",
  restricted: "Restricted",
  inactive: "Inactive",
};

export function PrivilegesPage() {
  const [query, setQuery] = useState("");
  const [modules, setModules] = useState<readonly string[]>(["All Modules"]);
  const [module, setModule] = useState("All Modules");
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await getPrivileges({ query, module: module as Privilege["module"] | "All Modules" });
    setPrivileges(list);
    setLoading(false);
  }, [query, module]);

  useEffect(() => {
    getPrivilegeModules().then((m) => setModules(m));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<Privilege>[] = [
    { key: "code", header: "Permission Name", render: (p) => <span className="font-semibold text-[#111827]">{p.code}</span> },
    { key: "description", header: "Description", render: (p) => <span className="text-slate-600">{p.description}</span> },
    {
      key: "usedBy",
      header: "Used By Roles",
      render: (p) =>
        p.usedByRoles.length === 0 ? (
          <span className="text-slate-400">None</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {p.usedByRoles.map((r) => (
              <RoleChip key={r} label={r} />
            ))}
          </div>
        ),
    },
    { key: "status", header: "Status", render: (p) => <StatusPill label={STATUS_LABEL[p.status]} tone={STATUS_TONE[p.status]} /> },
    {
      key: "actions",
      header: "Actions",
      render: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-200 hover:bg-orange-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Privileges"
        subtitle="Manage and assign granular system permissions."
        actions={
          <button type="button" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Privilege
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search privileges…"
          className="sm:max-w-xs sm:flex-1"
        />
        <FilterChips value={module} options={modules} onChange={setModule} />
      </div>

      <DataTable
        columns={columns}
        rows={privileges}
        rowKey={(p) => p.id}
        loading={loading}
        emptyMessage="No privileges match your filters."
      />

      {!loading && (
        <p className="mt-3 text-sm text-slate-500">
          Showing {privileges.length === 0 ? 0 : 1} to {privileges.length} of {privileges.length}{" "}
          privileges
        </p>
      )}
    </div>
  );
}
