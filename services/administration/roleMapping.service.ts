import { ASSIGNABLE_ROLES, ROLE_MAPPING_USERS } from "@/constants/administration/roleMapping";
import type { AssignableRole, RoleMappingUser } from "@/lib/administration/types";

let mappingStore: RoleMappingUser[] = [...ROLE_MAPPING_USERS];

export function getRoleMappingUsers(category?: string): Promise<RoleMappingUser[]> {
  if (!category || category === "All Users") return Promise.resolve(mappingStore);
  return Promise.resolve(mappingStore.filter((u) => u.category === category));
}

export function getRoleMappingUser(id: string): Promise<RoleMappingUser | null> {
  return Promise.resolve(mappingStore.find((u) => u.id === id) ?? null);
}

export function getAssignableRoles(): Promise<AssignableRole[]> {
  return Promise.resolve(ASSIGNABLE_ROLES);
}

export function removeAssignedRole(
  userId: string,
  roleId: string
): Promise<RoleMappingUser | null> {
  const idx = mappingStore.findIndex((u) => u.id === userId);
  if (idx === -1) return Promise.resolve(null);
  const user = mappingStore[idx];
  const updated: RoleMappingUser = {
    ...user,
    assignedRoles: user.assignedRoles.filter((r) => r.id !== roleId),
  };
  mappingStore[idx] = updated;
  return Promise.resolve(updated);
}

export function assignRoleToUser(
  userId: string,
  role: AssignableRole
): Promise<RoleMappingUser | null> {
  const idx = mappingStore.findIndex((u) => u.id === userId);
  if (idx === -1) return Promise.resolve(null);
  const user = mappingStore[idx];
  if (user.assignedRoles.some((r) => r.name === role.name)) {
    return Promise.resolve(user);
  }
  const updated: RoleMappingUser = {
    ...user,
    assignedRoles: [
      ...user.assignedRoles,
      {
        id: `assigned-${role.id}-${Date.now()}`,
        name: role.name,
        description: role.description,
        icon: role.icon,
      },
    ],
  };
  mappingStore[idx] = updated;
  return Promise.resolve(updated);
}
