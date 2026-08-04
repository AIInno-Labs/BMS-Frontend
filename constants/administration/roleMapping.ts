import { USERS } from "@/constants/administration/users";
import { ROLES } from "@/constants/administration/roles";
import type { AssignableRole, AssignedRole, RoleMappingUser } from "@/lib/administration/types";

function roleDescription(name: string): string {
  return ROLES.find((r) => r.name === name)?.description ?? "";
}

function assignedRole(name: string, icon: AssignedRole["icon"]): AssignedRole {
  return {
    id: `assigned-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    description: roleDescription(name),
    icon,
  };
}

function byId(id: string) {
  const user = USERS.find((u) => u.id === id);
  if (!user) throw new Error(`Unknown seed user id: ${id}`);
  return user;
}

const sarahJenkins = byId("user-1");
const marcusThorne = byId("user-2");
const davidChen = byId("user-3");
const rahulSharma = byId("user-6");
const nehaSingh = byId("user-8");

export const ROLE_MAPPING_USERS: RoleMappingUser[] = [
  {
    id: sarahJenkins.id,
    fullName: sarahJenkins.fullName,
    email: sarahJenkins.email,
    department: sarahJenkins.department,
    category: "Admins",
    avatarInitials: sarahJenkins.avatarInitials,
    avatarColor: sarahJenkins.avatarColor,
    online: true,
    roleNames: ["Org Admin"],
    assignedRoles: [assignedRole("Org Admin", "shield")],
    effectivePermissions: [
      {
        module: "Administration",
        scope: "full",
        scopeLabel: "Full Access",
        actions: [
          { label: "View", granted: true },
          { label: "Create", granted: true },
          { label: "Edit", granted: true },
          { label: "Delete", granted: true },
        ],
      },
      {
        module: "Jobs & Work Orders",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "View", granted: true },
          { label: "Create", granted: true },
          { label: "Edit", granted: true },
          { label: "Delete", granted: false },
        ],
      },
      {
        module: "Settings",
        scope: "full",
        scopeLabel: "Full Access",
        actions: [
          { label: "View", granted: true },
          { label: "Edit", granted: true },
        ],
      },
    ],
  },
  {
    id: marcusThorne.id,
    fullName: marcusThorne.fullName,
    email: marcusThorne.email,
    department: marcusThorne.department,
    category: "Operations",
    avatarInitials: marcusThorne.avatarInitials,
    avatarColor: marcusThorne.avatarColor,
    online: true,
    roleNames: ["Operations Manager"],
    assignedRoles: [assignedRole("Operations Manager", "wrench")],
    effectivePermissions: [
      {
        module: "Jobs & Work Orders",
        scope: "full",
        scopeLabel: "Full Access",
        actions: [
          { label: "View", granted: true },
          { label: "Create", granted: true },
          { label: "Edit", granted: true },
          { label: "Approve", granted: true },
        ],
      },
      {
        module: "Quotes & Invoicing",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "View", granted: true },
          { label: "Create", granted: true },
          { label: "Edit", granted: true },
        ],
      },
      {
        module: "Administration",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
  {
    id: davidChen.id,
    fullName: davidChen.fullName,
    email: davidChen.email,
    department: davidChen.department,
    category: "Engineering",
    avatarInitials: davidChen.avatarInitials,
    avatarColor: davidChen.avatarColor,
    online: false,
    roleNames: ["Field Engineer"],
    assignedRoles: [assignedRole("Field Engineer", "wrench")],
    effectivePermissions: [
      {
        module: "Jobs & Work Orders",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "View", granted: true },
          { label: "Edit", granted: true },
        ],
      },
      {
        module: "Quotes & Invoicing",
        scope: "none",
        scopeLabel: "View Only",
        actions: [{ label: "View", granted: true }],
      },
      {
        module: "Administration",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
  {
    id: rahulSharma.id,
    fullName: rahulSharma.fullName,
    email: rahulSharma.email,
    department: rahulSharma.department,
    category: "Engineering",
    avatarInitials: rahulSharma.avatarInitials,
    avatarColor: rahulSharma.avatarColor,
    online: false,
    roleNames: ["Support Specialist"],
    assignedRoles: [assignedRole("Support Specialist", "eye")],
    effectivePermissions: [
      {
        module: "Quotes & Invoicing",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "View", granted: true },
          { label: "Create", granted: true },
        ],
      },
      {
        module: "Jobs & Work Orders",
        scope: "none",
        scopeLabel: "View Only",
        actions: [{ label: "View", granted: true }],
      },
      {
        module: "Administration",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
  {
    id: nehaSingh.id,
    fullName: nehaSingh.fullName,
    email: nehaSingh.email,
    department: nehaSingh.department,
    category: "Engineering",
    avatarInitials: nehaSingh.avatarInitials,
    avatarColor: nehaSingh.avatarColor,
    online: true,
    roleNames: ["Support Specialist", "+1 Role"],
    assignedRoles: [
      assignedRole("Support Specialist", "eye"),
      assignedRole("Field Engineer", "wrench"),
    ],
    effectivePermissions: [
      {
        module: "Quotes & Invoicing",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "View", granted: true },
          { label: "Create", granted: true },
        ],
      },
      {
        module: "Jobs & Work Orders",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "View", granted: true },
          { label: "Edit", granted: true },
        ],
      },
      {
        module: "Administration",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
];

export const ASSIGNABLE_ROLES: AssignableRole[] = ROLES.map((r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  icon: r.icon,
}));
