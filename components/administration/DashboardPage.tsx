"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/administration/ui/PageHeader";
import { StatCard } from "@/components/administration/ui/StatCard";
import { InfoCard } from "@/components/administration/ui/InfoCard";
import { LoadingState } from "@/components/administration/ui/EmptyState";
import { StatusPill } from "@/components/administration/ui/StatusPill";
import {
  getDashboardStats,
  getRecentActivity,
  getRecentlyCreatedUsers,
  getUserDistribution,
} from "@/services/administration/dashboard.service";
import type {
  AdminUser,
  DashboardStats,
  RecentActivity,
  UserDistributionSegment,
} from "@/lib/administration/types";

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [distribution, setDistribution] = useState<UserDistributionSegment[]>([]);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboardStats(),
      getUserDistribution(),
      getRecentlyCreatedUsers(),
      getRecentActivity(),
    ]).then(([s, d, users, act]) => {
      setStats(s);
      setDistribution(d);
      setRecentUsers(users);
      setActivity(act);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return <LoadingState label="Loading dashboard…" />;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Administration Dashboard"
        subtitle="Manage system settings, users, and integrations."
        actions={
          <>
            <button type="button" className="btn-secondary inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Audit Log
            </button>
            <Link
              href="/administration/users/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New User
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          trend={{ label: `↑ ${stats.totalUsersDelta}`, tone: "positive" }}
          sub="Across 4 Departments"
        />
        <StatCard
          icon={UserCheck}
          iconClassName="bg-emerald-50 text-emerald-600"
          label="Active Users"
          value={stats.activeUsers}
          trend={{ label: "Healthy", tone: "positive" }}
        >
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${(stats.activeUsers / stats.totalUsers) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{stats.disabledUsers} Disabled</p>
        </StatCard>
        <StatCard
          icon={ShieldCheck}
          iconClassName="bg-violet-50 text-violet-600"
          label="Total Roles"
          value={stats.totalRoles}
          trend={{ label: `${stats.rolesUpdated} Updated`, tone: "neutral" }}
          sub="Access Control Groups"
        />
      </div>

      <div className="mt-6">
        <div className="app-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#111827]">User Distribution</h3>
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {distribution.map((seg) => (
                      <Cell key={seg.label} fill={seg.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#111827]">{stats.totalUsers}</span>
                <span className="text-xs text-slate-500">Total</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {distribution.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: seg.color }}
                    />
                    {seg.label}
                  </span>
                  <span className="font-semibold text-[#111827]">{seg.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="app-card lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-[#111827]">Recently Created Users</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Assigned Role</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-[#111827]">{u.fullName}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{u.roleNames.join(", ")}</td>
                    <td className="py-2.5 pr-4">
                      <StatusPill
                        label={u.status === "pending" ? "Pending Setup" : "Active"}
                        tone={u.status === "pending" ? "warning" : "success"}
                        showIcon={false}
                      />
                    </td>
                    <td className="py-2.5 text-slate-500">{u.lastLogin ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <InfoCard title="Recent Role Updates">
          {activity.map((a) => (
            <div key={a.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-semibold text-[#111827]">{a.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {a.timestamp} by {a.actor}
              </p>
            </div>
          ))}
        </InfoCard>
      </div>
    </div>
  );
}
