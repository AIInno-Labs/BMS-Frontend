import { DEPARTMENTS, USERS } from "@/constants/administration/users";
import { ROLES } from "@/constants/administration/roles";
import type { AdminUser, CreateUserPayload } from "@/lib/administration/types";

let userStore: AdminUser[] = [...USERS];

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
];

export interface GetUsersParams {
  query?: string;
  status?: AdminUser["status"] | "all";
  roleId?: string | "all";
  page?: number;
  pageSize?: number;
}

export interface PagedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getUsers(params: GetUsersParams = {}): Promise<PagedUsers> {
  const { query = "", status = "all", roleId = "all", page = 1, pageSize = 5 } = params;
  const q = query.trim().toLowerCase();

  const filtered = userStore.filter((u) => {
    if (status !== "all" && u.status !== status) return false;
    if (roleId !== "all" && !u.roleIds.includes(roleId)) return false;
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return Promise.resolve({ items, total, page, pageSize, totalPages });
}

export function getUser(id: string): Promise<AdminUser | null> {
  return Promise.resolve(userStore.find((u) => u.id === id) ?? null);
}

export function getDepartments(): Promise<readonly string[]> {
  return Promise.resolve(DEPARTMENTS);
}

export function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const role = ROLES.find((r) => r.id === payload.roleId);
  const user: AdminUser = {
    id: `user-${userStore.length + 1}`,
    firstName: payload.firstName,
    lastName: payload.lastName,
    fullName: `${payload.firstName} ${payload.lastName}`,
    email: payload.email,
    phone: payload.phone,
    department: payload.department,
    roleIds: role ? [role.id] : [],
    roleNames: role ? [role.name] : [],
    status: payload.accountActive ? "active" : "pending",
    lastLogin: null,
    avatarInitials: initials(payload.firstName, payload.lastName),
    avatarColor: AVATAR_COLORS[userStore.length % AVATAR_COLORS.length],
    region: "North America",
    createdAt: new Date().toISOString(),
  };
  userStore = [user, ...userStore];
  return Promise.resolve(user);
}

export function updateUser(
  id: string,
  patch: Partial<
    Pick<
      AdminUser,
      "status" | "roleIds" | "roleNames" | "firstName" | "lastName" | "email" | "phone" | "department"
    >
  >
): Promise<AdminUser | null> {
  const idx = userStore.findIndex((u) => u.id === id);
  if (idx === -1) return Promise.resolve(null);
  const next = { ...userStore[idx], ...patch };
  if (patch.firstName || patch.lastName) {
    next.fullName = `${next.firstName} ${next.lastName}`;
    next.avatarInitials = initials(next.firstName, next.lastName);
  }
  userStore[idx] = next;
  return Promise.resolve(userStore[idx]);
}

export function disableUser(id: string): Promise<AdminUser | null> {
  return updateUser(id, { status: "inactive" });
}

export interface EditUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  roleId: string;
  accountActive: boolean;
}

export function updateUserDetails(id: string, payload: EditUserPayload): Promise<AdminUser | null> {
  const role = ROLES.find((r) => r.id === payload.roleId);
  return updateUser(id, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    department: payload.department,
    roleIds: role ? [role.id] : [],
    roleNames: role ? [role.name] : [],
    status: payload.accountActive ? "active" : "inactive",
  });
}

export interface RegionDistribution {
  region: AdminUser["region"];
  percent: number;
}

export function getRegionDistribution(): Promise<RegionDistribution[]> {
  const total = userStore.length;
  const counts = new Map<AdminUser["region"], number>();
  for (const u of userStore) {
    counts.set(u.region, (counts.get(u.region) ?? 0) + 1);
  }
  const order: AdminUser["region"][] = ["North America", "Europe", "Asia Pacific"];
  const distribution = order.map((region) => ({
    region,
    percent: total === 0 ? 0 : Math.round(((counts.get(region) ?? 0) / total) * 100),
  }));
  return Promise.resolve(distribution);
}
