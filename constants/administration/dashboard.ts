import type {
  DashboardStats,
  RecentActivity,
  SystemStatusItem,
  UserDistributionSegment,
} from "@/lib/administration/types";

export const DASHBOARD_STATS: DashboardStats = {
  totalUsers: 124,
  totalUsersDelta: 12,
  activeUsers: 118,
  disabledUsers: 6,
  totalRoles: 8,
  accessControlGroups: 8,
  rolesUpdated: 2,
  systemHealthPercent: 100,
};

export const USER_DISTRIBUTION: UserDistributionSegment[] = [
  { label: "Workshop / Field", count: 64, color: "#F97316" },
  { label: "Project Managers", count: 28, color: "#475569" },
  { label: "Draftsmen", count: 15, color: "#10B981" },
  { label: "Admin / Accounts", count: 12, color: "#FDA98A" },
  { label: "Sales / QA", count: 5, color: "#CBD5E1" },
];

export const SYSTEM_STATUS: SystemStatusItem[] = [
  { name: "SharePoint", connected: true },
  { name: "Quotient", connected: true },
];

export const RECENTLY_CREATED_USER_IDS = ["user-11", "user-12", "user-13"];

export const RECENT_ACTIVITY: RecentActivity[] = [
  {
    id: "activity-1",
    title: "QA Role Created",
    description:
      "New permission set created for Quality Assurance team, restricted to view-only on financial modules.",
    actor: "Admin User",
    timestamp: "Today, 09:45 AM",
  },
  {
    id: "activity-2",
    title: "Admin Role Updated",
    description: "Added new permissions for Quotient integration configuration.",
    actor: "System",
    timestamp: "Yesterday, 14:20 PM",
  },
  {
    id: "activity-3",
    title: "Workshop Access Modified",
    description: "Removed legacy permissions for old inventory tracking module.",
    actor: "Admin User",
    timestamp: "Oct 12, 11:15 AM",
  },
];
