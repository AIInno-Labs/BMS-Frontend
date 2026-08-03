import type { CreateRolePayload, PermissionModuleGroup, Role } from "@/lib/administration/types";

export const ROLES: Role[] = [
  {
    id: "role-administrator",
    name: "Administrator",
    description: "Full access to all system features and settings.",
    usersCount: 3,
    permissionsCount: 132,
    status: "active",
    isSystemAdmin: true,
    icon: "shield",
  },
  {
    id: "role-operations-manager",
    name: "Operations Manager",
    description: "Manage jobs, quotes, and view analytics.",
    usersCount: 12,
    permissionsCount: 84,
    status: "active",
    isSystemAdmin: false,
    icon: "briefcase",
  },
  {
    id: "role-field-engineer",
    name: "Field Engineer",
    description: "Update job status and view assigned tasks.",
    usersCount: 46,
    permissionsCount: 28,
    status: "active",
    isSystemAdmin: false,
    icon: "wrench",
  },
  {
    id: "role-support-specialist",
    name: "Support Specialist",
    description: "View customer data, manage tickets and basic quotes.",
    usersCount: 34,
    permissionsCount: 45,
    status: "active",
    isSystemAdmin: false,
    icon: "headset",
  },
  {
    id: "role-guest-viewer",
    name: "Guest Viewer",
    description: "Read-only access to selected public dashboards.",
    usersCount: 0,
    permissionsCount: 5,
    status: "inactive",
    isSystemAdmin: false,
    icon: "eye",
  },
];

export const PERMISSION_MODULE_TEMPLATE: PermissionModuleGroup[] = [
  {
    module: "Dashboard",
    description: "Landing KPIs and activity feed",
    actions: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
  },
  {
    module: "Jobs & Work Orders",
    description: "Manage field tasks and scheduling",
    actions: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
  },
  {
    module: "Quotes & Invoicing",
    description: "Financial estimates and billing",
    actions: { view: true, create: true, edit: true, delete: false, approve: false, export: false },
  },
  {
    module: "Administration",
    description: "Users, roles, and privilege management",
    actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
  },
  {
    module: "Analytics",
    description: "Trends, timelines, and reporting",
    actions: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
  },
  {
    module: "Settings",
    description: "Profile, SharePoint, and Quotient configuration",
    actions: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
  },
];

export const DEFAULT_CREATE_ROLE_PAYLOAD: CreateRolePayload = {
  name: "",
  description: "",
  isSystemAdmin: false,
  permissions: PERMISSION_MODULE_TEMPLATE.map((group) => ({
    ...group,
    actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
  })),
};
