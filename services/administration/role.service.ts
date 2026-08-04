import {
  DEFAULT_CREATE_ROLE_PAYLOAD,
  PERMISSION_MODULE_TEMPLATE,
  ROLES,
} from "@/constants/administration/roles";
import type { CreateRolePayload, PermissionModuleGroup, Role } from "@/lib/administration/types";

let roleStore: Role[] = [...ROLES];

export function getRoles(): Promise<Role[]> {
  return Promise.resolve(roleStore);
}

export function getRole(id: string): Promise<Role | null> {
  return Promise.resolve(roleStore.find((r) => r.id === id) ?? null);
}

export function getPermissionTemplate(): Promise<PermissionModuleGroup[]> {
  return Promise.resolve(PERMISSION_MODULE_TEMPLATE);
}

export function getDefaultCreateRolePayload(): Promise<CreateRolePayload> {
  return Promise.resolve(DEFAULT_CREATE_ROLE_PAYLOAD);
}

function countGrantedPermissions(groups: PermissionModuleGroup[]): number {
  return groups.reduce(
    (sum, group) => sum + Object.values(group.actions).filter(Boolean).length,
    0
  );
}

export function createRole(payload: CreateRolePayload): Promise<Role> {
  const role: Role = {
    id: `role-${roleStore.length + 1}-${Date.now()}`,
    name: payload.name,
    description: payload.description,
    usersCount: 0,
    permissions: payload.permissions,
    permissionsCount: countGrantedPermissions(payload.permissions),
    status: "active",
    isSystemAdmin: payload.isSystemAdmin,
    icon: payload.isSystemAdmin ? "shield" : "briefcase",
  };
  roleStore = [...roleStore, role];
  return Promise.resolve(role);
}

export function updateRolePermissions(
  id: string,
  permissions: PermissionModuleGroup[]
): Promise<Role | null> {
  return updateRole(id, {
    permissions,
    permissionsCount: countGrantedPermissions(permissions),
  });
}

export function updateRoleDetails(id: string, payload: CreateRolePayload): Promise<Role | null> {
  const existing = roleStore.find((r) => r.id === id);
  const icon = payload.isSystemAdmin ? "shield" : existing?.icon ?? "briefcase";
  return updateRole(id, {
    name: payload.name,
    description: payload.description,
    isSystemAdmin: payload.isSystemAdmin,
    icon,
    permissions: payload.permissions,
    permissionsCount: countGrantedPermissions(payload.permissions),
  });
}

export function updateRole(id: string, patch: Partial<Role>): Promise<Role | null> {
  const idx = roleStore.findIndex((r) => r.id === id);
  if (idx === -1) return Promise.resolve(null);
  roleStore[idx] = { ...roleStore[idx], ...patch };
  return Promise.resolve(roleStore[idx]);
}

export function deleteRole(id: string): Promise<boolean> {
  const before = roleStore.length;
  roleStore = roleStore.filter((r) => r.id !== id);
  return Promise.resolve(roleStore.length < before);
}
