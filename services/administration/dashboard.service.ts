import {
  DASHBOARD_STATS,
  RECENTLY_CREATED_USER_IDS,
  RECENT_ACTIVITY,
  USER_DISTRIBUTION,
} from "@/constants/administration/dashboard";
import { USERS } from "@/constants/administration/users";
import type {
  AdminUser,
  DashboardStats,
  RecentActivity,
  UserDistributionSegment,
} from "@/lib/administration/types";

export function getDashboardStats(): Promise<DashboardStats> {
  return Promise.resolve(DASHBOARD_STATS);
}

export function getUserDistribution(): Promise<UserDistributionSegment[]> {
  return Promise.resolve(USER_DISTRIBUTION);
}

export function getRecentlyCreatedUsers(): Promise<AdminUser[]> {
  const byId = new Map(USERS.map((u) => [u.id, u]));
  const users = RECENTLY_CREATED_USER_IDS.map((id) => byId.get(id)).filter(
    (u): u is AdminUser => Boolean(u)
  );
  return Promise.resolve(users);
}

export function getRecentActivity(): Promise<RecentActivity[]> {
  return Promise.resolve(RECENT_ACTIVITY);
}
