export type AdminUserStatus = "active" | "inactive" | "locked" | "pending";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  department: string;
  roleIds: string[];
  roleNames: string[];
  status: AdminUserStatus;
  lastLogin: string | null;
  failedAttempts?: number;
  avatarInitials: string;
  avatarColor: string;
  region: "North America" | "Europe" | "Asia Pacific";
  createdAt: string;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  generatePassword: boolean;
  roleId: string;
  accountActive: boolean;
  requireMfa: boolean;
}

export type RoleStatus = "active" | "inactive";

export interface Role {
  id: string;
  name: string;
  description: string;
  usersCount: number;
  permissionsCount: number;
  status: RoleStatus;
  isSystemAdmin: boolean;
  icon: "shield" | "briefcase" | "wrench" | "eye" | "headset";
}

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export";

export interface PermissionModuleGroup {
  module: string;
  description: string;
  actions: Record<PermissionAction, boolean>;
}

export interface CreateRolePayload {
  name: string;
  description: string;
  isSystemAdmin: boolean;
  permissions: PermissionModuleGroup[];
}

export type PrivilegeStatus = "active" | "restricted" | "inactive";

export interface Privilege {
  id: string;
  code: string;
  description: string;
  module: "Users" | "Jobs" | "Quotes" | "System";
  usedByRoles: string[];
  status: PrivilegeStatus;
}

export type PermissionScope = "full" | "manage" | "none";

export interface EffectivePermissionRow {
  module: string;
  scope: PermissionScope;
  scopeLabel: string;
  actions: { label: string; granted: boolean }[];
}

export interface AssignedRole {
  id: string;
  name: string;
  description: string;
  icon: "shield" | "wrench" | "eye";
}

export interface RoleMappingUser {
  id: string;
  fullName: string;
  email: string;
  department: string;
  category: "Engineering" | "Operations" | "Admins";
  avatarInitials: string;
  avatarColor: string;
  online: boolean;
  roleNames: string[];
  assignedRoles: AssignedRole[];
  effectivePermissions: EffectivePermissionRow[];
}

export type AuditAction =
  | "CREATE_RECORD"
  | "UPDATE_RECORD"
  | "DELETE_RECORD"
  | "AUTH_LOGIN";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  targetType: string;
  targetLabel: string;
  detailFrom?: string;
  detailTo?: string;
  detailText?: string;
  ipAddress: string;
  device: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalUsersDelta: number;
  activeUsers: number;
  disabledUsers: number;
  totalRoles: number;
  accessControlGroups: number;
  rolesUpdated: number;
  systemHealthPercent: number;
}

export interface UserDistributionSegment {
  label: string;
  count: number;
  color: string;
}

export interface SystemStatusItem {
  name: "SharePoint" | "Quotient";
  connected: boolean;
}

export interface RecentActivity {
  id: string;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
}

export interface SharePointConfig {
  connected: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteUrl: string;
  documentLibrary: string;
  defaultRootFolder: string;
  lastSynced: string | null;
}

export interface QuotientConfig {
  connected: boolean;
  apiBaseUrl: string;
  apiKey: string;
  webhookEndpoint: string;
  webhookSecret: string;
  lastSync: string | null;
  quotesSyncedTotal: number;
  pendingWebhooks: number;
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}
