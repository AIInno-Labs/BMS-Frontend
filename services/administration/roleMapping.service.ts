import { ASSIGNABLE_ROLES, ROLE_MAPPING_USERS } from "@/constants/administration/roleMapping";
import type { RoleMappingUser } from "@/lib/administration/types";

let mappingStore: RoleMappingUser[] = [...ROLE_MAPPING_USERS];

export function getRoleMappingUsers(category?: string): Promise<RoleMappingUser[]> {
  if (!category || category === "All Users") return Promise.resolve(mappingStore);
  return Promise.resolve(mappingStore.filter((u) => u.category === category));
}

export function getRoleMappingUser(id: string): Promise<RoleMappingUser | null> {
  return Promise.resolve(mappingStore.find((u) => u.id === id) ?? null);
}

export function getAssignableRoles(): Promise<string[]> {
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
  roleName: string
): Promise<RoleMappingUser | null> {
  const idx = mappingStore.findIndex((u) => u.id === userId);
  if (idx === -1) return Promise.resolve(null);
  const user = mappingStore[idx];
  const updated: RoleMappingUser = {
    ...user,
    assignedRoles: [
      ...user.assignedRoles,
      {
        id: `assigned-${roleName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name: roleName,
        description: "Newly assigned role.",
        icon: "wrench",
      },
    ],
  };
  mappingStore[idx] = updated;
  return Promise.resolve(updated);
}
