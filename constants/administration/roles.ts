import type { CreateRolePayload, PermissionAction, PermissionModuleGroup, Role } from "@/lib/administration/types";
import { USERS } from "@/constants/administration/users";

function usersWithRole(roleId: string): number {
  return USERS.filter((u) => u.roleIds.includes(roleId)).length;
}

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

function countGrantedPermissions(groups: PermissionModuleGroup[]): number {
  return groups.reduce(
    (sum, group) => sum + Object.values(group.actions).filter(Boolean).length,
    0
  );
}

function buildPermissions(
  grants: Record<string, PermissionAction[]>
): PermissionModuleGroup[] {
  return PERMISSION_MODULE_TEMPLATE.map((group) => {
    const granted = new Set(grants[group.module] ?? []);
    return {
      ...group,
      actions: {
        view: granted.has("view"),
        create: granted.has("create"),
        edit: granted.has("edit"),
        delete: granted.has("delete"),
        approve: granted.has("approve"),
        export: granted.has("export"),
      },
    };
  });
}

interface RoleSeed {
  id: string;
  name: string;
  description: string;
  status: Role["status"];
  isSystemAdmin: boolean;
  icon: Role["icon"];
  permissions: PermissionModuleGroup[];
}

const ROLE_SEEDS: RoleSeed[] = [
  {
    id: "role-org-admin",
    name: "Org Admin",
    description: "Full administrative access within your organization — manage users, roles, and integrations.",
    status: "active",
    isSystemAdmin: true,
    icon: "shield",
    permissions: buildPermissions({
      Dashboard: ["view", "export"],
      "Jobs & Work Orders": ["view", "create", "edit", "approve", "export"],
      "Quotes & Invoicing": ["view", "create", "edit", "approve", "export"],
      Administration: ["view", "create", "edit", "delete"],
      Analytics: ["view", "export"],
      Settings: ["view", "edit"],
    }),
  },
  {
    id: "role-operations-manager",
    name: "Operations Manager",
    description: "Manage jobs, quotes, and view analytics.",
    status: "active",
    isSystemAdmin: false,
    icon: "briefcase",
    permissions: buildPermissions({
      Dashboard: ["view", "export"],
      "Jobs & Work Orders": ["view", "create", "edit", "approve"],
      "Quotes & Invoicing": ["view", "create", "edit"],
      Analytics: ["view", "export"],
      Settings: ["view"],
    }),
  },
  {
    id: "role-field-engineer",
    name: "Field Engineer",
    description: "Update job status and view assigned tasks.",
    status: "active",
    isSystemAdmin: false,
    icon: "wrench",
    permissions: buildPermissions({
      Dashboard: ["view"],
      "Jobs & Work Orders": ["view", "edit"],
      "Quotes & Invoicing": ["view"],
      Settings: ["view"],
    }),
  },
  {
    id: "role-support-specialist",
    name: "Support Specialist",
    description: "View customer data, manage tickets and basic quotes.",
    status: "active",
    isSystemAdmin: false,
    icon: "headset",
    permissions: buildPermissions({
      Dashboard: ["view"],
      "Jobs & Work Orders": ["view"],
      "Quotes & Invoicing": ["view", "create"],
      Analytics: ["view"],
      Settings: ["view"],
    }),
  },
  {
    id: "role-guest-viewer",
    name: "Guest Viewer",
    description: "Read-only access to selected public dashboards.",
    status: "inactive",
    isSystemAdmin: false,
    icon: "eye",
    permissions: buildPermissions({
      Dashboard: ["view"],
      "Jobs & Work Orders": ["view"],
    }),
  },
];

export const ROLES: Role[] = ROLE_SEEDS.map((role) => ({
  ...role,
  usersCount: usersWithRole(role.id),
  permissionsCount: countGrantedPermissions(role.permissions),
}));

export const DEFAULT_CREATE_ROLE_PAYLOAD: CreateRolePayload = {
  name: "",
  description: "",
  isSystemAdmin: false,
  permissions: PERMISSION_MODULE_TEMPLATE.map((group) => ({
    ...group,
    actions: { view: false, create: false, edit: false, delete: false, approve: false, export: false },
  })),
};
