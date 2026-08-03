import { PRIVILEGES, PRIVILEGE_MODULES } from "@/constants/administration/privileges";
import type { Privilege } from "@/lib/administration/types";

let privilegeStore: Privilege[] = [...PRIVILEGES];

export interface GetPrivilegesParams {
  query?: string;
  module?: (typeof PRIVILEGE_MODULES)[number];
}

export function getPrivileges(params: GetPrivilegesParams = {}): Promise<Privilege[]> {
  const { query = "", module = "All Modules" } = params;
  const q = query.trim().toLowerCase();

  const filtered = privilegeStore.filter((p) => {
    if (module !== "All Modules" && p.module !== module) return false;
    if (!q) return true;
    return (
      p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  });

  return Promise.resolve(filtered);
}

export function getPrivilege(id: string): Promise<Privilege | null> {
  return Promise.resolve(privilegeStore.find((p) => p.id === id) ?? null);
}

export function getPrivilegeModules(): Promise<readonly string[]> {
  return Promise.resolve(PRIVILEGE_MODULES);
}

export function createPrivilege(
  payload: Omit<Privilege, "id" | "usedByRoles">
): Promise<Privilege> {
  const privilege: Privilege = {
    ...payload,
    id: `priv-${privilegeStore.length + 1}-${Date.now()}`,
    usedByRoles: [],
  };
  privilegeStore = [...privilegeStore, privilege];
  return Promise.resolve(privilege);
}

export function updatePrivilege(
  id: string,
  patch: Partial<Privilege>
): Promise<Privilege | null> {
  const idx = privilegeStore.findIndex((p) => p.id === id);
  if (idx === -1) return Promise.resolve(null);
  privilegeStore[idx] = { ...privilegeStore[idx], ...patch };
  return Promise.resolve(privilegeStore[idx]);
}
