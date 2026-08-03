import type { RoleMappingUser } from "@/lib/administration/types";

export const ROLE_MAPPING_USERS: RoleMappingUser[] = [
  {
    id: "rm-sarah-jenkins",
    fullName: "Sarah Jenkins",
    email: "sarah.j@bmsman.com",
    department: "Operations",
    category: "Operations",
    avatarInitials: "SJ",
    avatarColor: "bg-slate-200 text-slate-700",
    online: false,
    roleNames: ["Plant Manager", "+1 Role"],
    assignedRoles: [
      {
        id: "assigned-plant-manager",
        name: "Plant Manager",
        description: "Oversees daily plant operations and staff scheduling.",
        icon: "shield",
      },
      {
        id: "assigned-support-specialist",
        name: "Support Specialist",
        description: "View customer data, manage tickets and basic quotes.",
        icon: "eye",
      },
    ],
    effectivePermissions: [
      {
        module: "System Configuration",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "Users", granted: true },
          { label: "Roles", granted: false },
          { label: "Settings", granted: true },
        ],
      },
      {
        module: "Work Orders",
        scope: "full",
        scopeLabel: "Full Access",
        actions: [
          { label: "Create", granted: true },
          { label: "Approve", granted: true },
          { label: "Delete", granted: false },
        ],
      },
      {
        module: "Financials",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
  {
    id: "rm-marcus-chen",
    fullName: "Marcus Chen",
    email: "m.chen@bmsman.com",
    department: "Engineering",
    category: "Engineering",
    avatarInitials: "MC",
    avatarColor: "bg-slate-200 text-slate-700",
    online: true,
    roleNames: ["System Admin", "Lead Technician"],
    assignedRoles: [
      {
        id: "assigned-system-admin",
        name: "System Admin",
        description: "Full access to system configurations and user…",
        icon: "shield",
      },
      {
        id: "assigned-lead-technician",
        name: "Lead Technician",
        description: "Can approve work orders, manage inventory, and…",
        icon: "wrench",
      },
    ],
    effectivePermissions: [
      {
        module: "System Configuration",
        scope: "full",
        scopeLabel: "Full Access",
        actions: [
          { label: "Users", granted: true },
          { label: "Roles", granted: true },
          { label: "Settings", granted: true },
        ],
      },
      {
        module: "Work Orders",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "Create", granted: true },
          { label: "Approve", granted: true },
          { label: "Delete", granted: false },
        ],
      },
      {
        module: "Financials",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
  {
    id: "rm-elena-rodriguez",
    fullName: "Elena Rodriguez",
    email: "elena.r@bmsman.com",
    department: "Operations",
    category: "Operations",
    avatarInitials: "ER",
    avatarColor: "bg-slate-200 text-slate-700",
    online: false,
    roleNames: ["Auditor"],
    assignedRoles: [
      {
        id: "assigned-auditor",
        name: "Auditor",
        description: "Read-only access across all modules for compliance review.",
        icon: "eye",
      },
    ],
    effectivePermissions: [
      {
        module: "System Configuration",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
      {
        module: "Work Orders",
        scope: "none",
        scopeLabel: "View Only",
        actions: [{ label: "View", granted: true }],
      },
      {
        module: "Financials",
        scope: "none",
        scopeLabel: "View Only",
        actions: [{ label: "View", granted: true }],
      },
    ],
  },
  {
    id: "rm-david-kim",
    fullName: "David Kim",
    email: "dkim@bmsman.com",
    department: "Admins",
    category: "Admins",
    avatarInitials: "DK",
    avatarColor: "bg-emerald-100 text-emerald-700",
    online: true,
    roleNames: ["Dispatcher", "+1 Role"],
    assignedRoles: [
      {
        id: "assigned-dispatcher",
        name: "Dispatcher",
        description: "Assigns field jobs and coordinates technician schedules.",
        icon: "wrench",
      },
      {
        id: "assigned-support-specialist-2",
        name: "Support Specialist",
        description: "View customer data, manage tickets and basic quotes.",
        icon: "eye",
      },
    ],
    effectivePermissions: [
      {
        module: "System Configuration",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
      {
        module: "Work Orders",
        scope: "manage",
        scopeLabel: "Manage",
        actions: [
          { label: "Create", granted: true },
          { label: "Approve", granted: false },
          { label: "Delete", granted: false },
        ],
      },
      {
        module: "Financials",
        scope: "none",
        scopeLabel: "No Access",
        actions: [],
      },
    ],
  },
];

export const ASSIGNABLE_ROLES = [
  "System Admin",
  "Lead Technician",
  "Plant Manager",
  "Dispatcher",
  "Support Specialist",
  "Auditor",
];
