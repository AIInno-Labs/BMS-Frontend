import type {
  DashboardStats,
  RecentActivity,
  UserDistributionSegment,
} from "@/lib/administration/types";
import { DEPARTMENTS, USERS } from "@/constants/administration/users";
import { ROLES } from "@/constants/administration/roles";

export const RECENTLY_CREATED_USER_IDS = ["user-11", "user-12", "user-13"];

export const DASHBOARD_STATS: DashboardStats = {
  totalUsers: USERS.length,
  totalUsersDelta: RECENTLY_CREATED_USER_IDS.length,
  activeUsers: USERS.filter((u) => u.status === "active").length,
  disabledUsers: USERS.filter((u) => u.status === "inactive" || u.status === "locked").length,
  totalRoles: ROLES.length,
  accessControlGroups: ROLES.length,
  rolesUpdated: 2,
};

const DEPARTMENT_COLORS: Record<(typeof DEPARTMENTS)[number], string> = {
  "Workshop / Field": "#F97316",
  "Project Managers": "#475569",
  "Draftsmen": "#10B981",
  "Admin / Accounts": "#FDA98A",
  "Sales / QA": "#CBD5E1",
};

export const USER_DISTRIBUTION: UserDistributionSegment[] = DEPARTMENTS.map((label) => ({
  label,
  count: USERS.filter((u) => u.department === label).length,
  color: DEPARTMENT_COLORS[label],
}));

export const RECENT_ACTIVITY: RecentActivity[] = [
  {
    id: "activity-1",
    title: "Guest Viewer Role Created",
    description:
      "New role added for read-only access, restricted to view-only on selected dashboards.",
    actor: "Sarah Jenkins",
    timestamp: "Today, 09:45 AM",
  },
  {
    id: "activity-2",
    title: "Support Specialist Role Updated",
    description: "Added new permissions for Quotes & Invoicing access.",
    actor: "David Kim",
    timestamp: "Yesterday, 17:08 PM",
  },
  {
    id: "activity-3",
    title: "Field Engineer Access Reviewed",
    description: "Confirmed Jobs & Work Orders permissions for the Workshop / Field team.",
    actor: "Sarah Jenkins",
    timestamp: "Oct 12, 11:15 AM",
  },
];
