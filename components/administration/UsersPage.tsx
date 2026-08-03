"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Globe2, Plus } from "lucide-react";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { SearchBar } from "@/components/administration/ui/SearchBar";
import { FilterDropdown } from "@/components/administration/ui/FilterDropdown";
import { DataTable, type DataTableColumn } from "@/components/administration/ui/DataTable";
import { StatusPill, type StatusPillTone } from "@/components/administration/ui/StatusPill";
import {
  getRegionDistribution,
  getUsers,
  type RegionDistribution,
} from "@/services/administration/user.service";
import { getRoles } from "@/services/administration/role.service";
import type { AdminUser, Role } from "@/lib/administration/types";

const STATUS_OPTIONS = ["all", "active", "inactive", "locked", "pending"] as const;
const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  all: "Status Filter",
  active: "Active",
  inactive: "Inactive",
  locked: "Locked",
  pending: "Pending",
};
const LABEL_TO_STATUS = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [STATUS_LABELS[s], s])
) as Record<string, (typeof STATUS_OPTIONS)[number]>;

const STATUS_TONE: Record<AdminUser["status"], StatusPillTone> = {
  active: "success",
  inactive: "neutral",
  locked: "danger",
  pending: "warning",
};

const STATUS_LABEL: Record<AdminUser["status"], string> = {
  active: "Active",
  inactive: "Inactive",
  locked: "Locked",
  pending: "Pending Setup",
};

const PAGE_SIZE = 5;

export function UsersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [roleId, setRoleId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [roles, setRoles] = useState<Role[]>([]);
  const [regions, setRegions] = useState<RegionDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getUsers({
      query,
      status: status as AdminUser["status"] | "all",
      roleId,
      page,
      pageSize: PAGE_SIZE,
    });
    setUsers(res.items);
    setTotal(res.total);
    setTotalPages(res.totalPages);
    setLoading(false);
  }, [query, status, roleId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getRoles().then(setRoles);
    getRegionDistribution().then(setRegions);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, status, roleId]);

  const columns: DataTableColumn<AdminUser>[] = [
    { key: "name", header: "Full Name", render: (u) => <span className="font-medium text-[#111827]">{u.fullName}</span> },
    { key: "email", header: "Email", render: (u) => <span className="text-slate-600">{u.email}</span> },
    { key: "role", header: "Assigned Role", render: (u) => u.roleNames.join(", ") || "—" },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <div>
          <StatusPill label={STATUS_LABEL[u.status]} tone={STATUS_TONE[u.status]} />
          {u.status === "locked" && u.failedAttempts != null && (
            <p className="mt-1 text-[11px] text-red-500">Failed attempts: {u.failedAttempts}</p>
          )}
        </div>
      ),
    },
    { key: "lastLogin", header: "Last Login", render: (u) => u.lastLogin ?? "—" },
  ];

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Users"
        subtitle="Manage system access, roles, and user statuses."
        actions={
          <Link href="/administration/users/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create User
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search users by name or email…"
          className="sm:max-w-xs sm:flex-1"
        />
        <FilterDropdown
          value={STATUS_LABELS[status as (typeof STATUS_OPTIONS)[number]]}
          onChange={(label) => setStatus(LABEL_TO_STATUS[label] ?? "all")}
          options={STATUS_OPTIONS.map((s) => STATUS_LABELS[s])}
        />
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#111827] shadow-sm outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
        >
          <option value="all">Role Filter</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        loading={loading}
        emptyMessage="No users match your filters."
        rowClassName={(u) => (u.status === "locked" ? "bg-red-50/60" : "")}
      />

      {total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Showing {start} to {end} of {total} results
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  p === page
                    ? "bg-[#F97316] text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="app-card mt-6">
        <h3 className="text-base font-semibold text-[#111827]">Global User Distribution</h3>
        <p className="mt-1 text-sm text-slate-500">
          Real-time overview of active sessions across regions.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            {regions.map((r) => (
              <div key={r.region}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>{r.region}</span>
                  <span>{r.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#F97316]"
                    style={{ width: `${r.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden h-24 w-24 items-center justify-center rounded-xl bg-violet-50 text-violet-300 sm:flex">
            <Globe2 className="h-10 w-10" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
