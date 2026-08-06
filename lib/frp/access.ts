import type { UserDTO } from "@/lib/frp/types";

/**
 * Every gated key. Add one here whenever a new nav section or action needs
 * gating — everything else (AppNav, page-level buttons) looks it up by key
 * instead of hardcoding privilege strings inline.
 */
export const ACCESS_KEYS = {
  JOBS_VIEW: "JOBS_VIEW",
  JOBS_CREATE: "JOBS_CREATE",
  JOBS_UPDATE: "JOBS_UPDATE",
  QUOTES_VIEW: "QUOTES_VIEW",
  ANALYTICS_VIEW: "ANALYTICS_VIEW",
} as const;

export type AccessKey = (typeof ACCESS_KEYS)[keyof typeof ACCESS_KEYS];

/**
 * Canonical MENU codes Super Admin should create for workshop nav.
 * Org Admin assigns these on custom roles; AppNav gates sidebar on them.
 */
export const MENU_CODES = {
  JOBS: "MENU_JOBS",
  QUOTES: "MENU_QUOTES",
  ANALYTICS: "MENU_ANALYTICS",
  DASHBOARD: "MENU_DASHBOARD",
} as const;

/**
 * UI access key → privilege code(s) that grant it.
 *
 * Nav/view keys prefer MENU_* (assignable by Org Admin from the Super Admin
 * catalog). ACTION codes remain as OR fallbacks so existing roles that only
 * have JOB_READ / QUOTE_READ keep working until MENU grants are rolled out.
 *
 * Create/update still map to ACTION — those are API privileges enforced by
 * the backend interceptor (see BMS-backend/docs/PRIVILEGE_MODEL.md).
 */
export const ACCESS_PRIVILEGE_MAP: Map<AccessKey, string | readonly string[]> =
  new Map<AccessKey, string | readonly string[]>([
    [ACCESS_KEYS.JOBS_VIEW, [MENU_CODES.JOBS, "JOB_READ"]],
    [ACCESS_KEYS.JOBS_CREATE, "JOB_CREATE"],
    [ACCESS_KEYS.JOBS_UPDATE, "JOB_UPDATE"],
    [ACCESS_KEYS.QUOTES_VIEW, [MENU_CODES.QUOTES, "QUOTE_READ"]],
    // Analytics: dedicated MENU, or dashboard MENU, or job-read fallback.
    [
      ACCESS_KEYS.ANALYTICS_VIEW,
      [MENU_CODES.ANALYTICS, MENU_CODES.DASHBOARD, "JOB_READ"],
    ],
  ]);

export function getPrivileges(user: UserDTO | null | undefined): string[] {
  return user?.rolesPrivileges ?? [];
}

/** True if the user holds at least one of the given privilege codes. */
export function hasPrivilege(
  user: UserDTO | null | undefined,
  required: string | readonly string[]
): boolean {
  const codes = Array.isArray(required) ? required : [required];
  const privileges = getPrivileges(user);
  return codes.some((code) => privileges.includes(code));
}

/** True if the user can access the given key. Unmapped keys default to visible. */
export function hasAccess(
  user: UserDTO | null | undefined,
  key: AccessKey
): boolean {
  const required = ACCESS_PRIVILEGE_MAP.get(key);
  if (!required) return true;
  return hasPrivilege(user, required);
}
