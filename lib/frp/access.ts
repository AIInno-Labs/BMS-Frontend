import type { UserDTO } from "@/lib/frp/types";
import type { FieldAccessMode } from "@/lib/frp/privilege-types";

/**
 * Every gated UI key. Add one here whenever a new nav section, action, or
 * field needs gating — call sites look it up by key instead of hardcoding
 * privilege strings inline.
 *
 * See BMS-backend/docs/PRIVILEGE_MODEL.md §5.1–§5.2.
 */
export const ACCESS_KEYS = {
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  JOBS_VIEW: "JOBS_VIEW",
  JOBS_CREATE: "JOBS_CREATE",
  JOBS_UPDATE: "JOBS_UPDATE",
  QUOTES_VIEW: "QUOTES_VIEW",
  ANALYTICS_VIEW: "ANALYTICS_VIEW",
  QUOTIENT_VIEW: "QUOTIENT_VIEW",
  SECURITY_VIEW: "SECURITY_VIEW",
} as const;

export type AccessKey = (typeof ACCESS_KEYS)[keyof typeof ACCESS_KEYS];

/**
 * Canonical MENU codes Super Admin should create for workshop nav.
 * Org Admin assigns these on custom roles; AppNav gates sidebar on them.
 */
export const MENU_CODES = {
  DASHBOARD: "MENU_DASHBOARD",
  JOBS: "MENU_JOBS",
  QUOTES: "MENU_QUOTES",
  ANALYTICS: "MENU_ANALYTICS",
  QUOTIENT: "MENU_QUOTIENT",
} as const;

/**
 * Canonical FIELD privilege codes (catalog `privilegeCode`).
 * Super Admin creates these with a `fieldKey` + `accessMode`; Org Admin
 * assigns the code on roles. `/auth/me` only returns codes, so the FE maps
 * UI field keys → codes here.
 */
export const FIELD_CODES = {
  JOB_RATE: "FIELD_JOB_RATE",
  HARDWARE: "FIELD_HARDWARE",
  SECURITY_MFA: "FIELD_SECURITY_MFA",
} as const;

/**
 * UI / form field keys — must match the catalog `fieldKey` Super Admin set
 * when creating the FIELD privilege (case-sensitive as stored).
 */
export const FIELD_KEYS = {
  RATE: "rate",
  HARDWARE: "HARDWARE",
} as const;

export type FieldKey = (typeof FIELD_KEYS)[keyof typeof FIELD_KEYS] | string;

type FieldPrivilegeBinding = {
  /** Codes that grant READ (view). WRITE codes also imply READ. */
  read: string | readonly string[];
  /** Codes that grant WRITE (edit). If omitted, `read` codes also allow WRITE. */
  write?: string | readonly string[];
};

/**
 * fieldKey → privilege binding.
 *
 * Unmapped field keys are unrestricted (`canField` returns true) so existing
 * UI keeps working until Super Admin creates a FIELD privilege and you add
 * an entry here + wrap the control with `FieldGate` / `canField`.
 */
export const FIELD_PRIVILEGE_MAP: Map<string, FieldPrivilegeBinding> = new Map([
  [FIELD_KEYS.RATE, { read: FIELD_CODES.JOB_RATE }],
  [FIELD_KEYS.HARDWARE, { read: FIELD_CODES.HARDWARE }],
]);

/**
 * UI access key → privilege code(s) that grant it.
 *
 * Nav/view keys are gated on MENU_* alone — Org Admin must explicitly assign
 * the MENU code from the Super Admin catalog for a sidebar link to show.
 * Holding the equivalent ACTION code (e.g. JOB_READ) is not sufficient by
 * itself; it only controls whether the underlying API calls succeed.
 *
 * Create/update still map to ACTION — those are API privileges enforced by
 * the backend interceptor (see PRIVILEGE_MODEL.md).
 */
export const ACCESS_PRIVILEGE_MAP: Map<AccessKey, string | readonly string[]> =
  new Map<AccessKey, string | readonly string[]>([
    // MENU_* is the sole gate for these four — no ACTION fallback. A role
    // with JOB_READ/QUOTE_READ but no matching MENU grant sees nothing here;
    // Org Admin must explicitly assign the MENU_* code for the link to show.
    // (Previously these OR'd in the ACTION code so pre-MENU-rollout roles
    // kept working — removed by product decision: MENU must be authoritative,
    // full stop. Any existing role relying on the old fallback needs its
    // MENU_* grants added explicitly — see docs/seed.sql for the demo role.)
    [ACCESS_KEYS.DASHBOARD_VIEW, [MENU_CODES.DASHBOARD, MENU_CODES.JOBS]],
    [ACCESS_KEYS.JOBS_VIEW, MENU_CODES.JOBS],
    [ACCESS_KEYS.JOBS_CREATE, "JOB_CREATE"],
    [ACCESS_KEYS.JOBS_UPDATE, "JOB_UPDATE"],
    [ACCESS_KEYS.QUOTES_VIEW, MENU_CODES.QUOTES],
    [ACCESS_KEYS.ANALYTICS_VIEW, [MENU_CODES.ANALYTICS, MENU_CODES.DASHBOARD]],
    // No ACTION equivalent — MENU_QUOTIENT must be assigned explicitly by Org
    // Admin (see CreateRoleDrawer) for a custom role to see it; no ACTION
    // fallback to fail open on like the keys above.
    [ACCESS_KEYS.QUOTIENT_VIEW, MENU_CODES.QUOTIENT],
    // Security lives inside Profile now (no route/nav link of its own), so it
    // has no MENU privilege — FIELD_SECURITY_MFA is the catalog-correct type
    // (a section within an existing page, not a screen). Deliberately checked
    // here via hasAccess() rather than canField()/FieldGate: FIELD privileges
    // fail OPEN by default (visible until a role holds any FIELD grant), which
    // would leave a zero-privilege role seeing Security by default — the exact
    // gap this whole privilege pass exists to close. Routing it through
    // ACCESS_PRIVILEGE_MAP instead makes it fail CLOSED, consistent with every
    // other key on this map.
    [ACCESS_KEYS.SECURITY_VIEW, FIELD_CODES.SECURITY_MFA],
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

/** True if the user can access the given nav/action key. Unmapped keys default to visible. */
export function hasAccess(
  user: UserDTO | null | undefined,
  key: AccessKey
): boolean {
  const required = ACCESS_PRIVILEGE_MAP.get(key);
  if (!required) return true;
  return hasPrivilege(user, required);
}

/**
 * True when this user is under FIELD ACL: they hold at least one privilege
 * code from FIELD_PRIVILEGE_MAP. Until Org Admin assigns any mapped FIELD,
 * field checks fail-open so existing ACTION-only roles keep seeing all fields.
 */
function isFieldAclActive(user: UserDTO | null | undefined): boolean {
  for (const binding of FIELD_PRIVILEGE_MAP.values()) {
    if (hasPrivilege(user, binding.read)) return true;
    if (binding.write && hasPrivilege(user, binding.write)) return true;
  }
  return false;
}

/**
 * Field-level ACL (MENU/ACTION are separate).
 *
 * - Unmapped `fieldKey` → allowed (not under FIELD ACL yet).
 * - Mapped + user has no mapped FIELD grants → allowed (migration fail-open).
 * - Mapped + user has at least one mapped FIELD → grant-to-see / grant-to-edit.
 * - WRITE: uses `write` codes when configured; otherwise the same `read` codes
 *   also grant write (catalog `accessMode` is not on the token in v1).
 * - Holding a WRITE code always implies READ.
 */
export function canField(
  user: UserDTO | null | undefined,
  fieldKey: FieldKey,
  mode: FieldAccessMode = "READ"
): boolean {
  const binding = FIELD_PRIVILEGE_MAP.get(fieldKey);
  if (!binding) return true;
  if (!isFieldAclActive(user)) return true;

  const writeCodes = binding.write;
  const hasWrite = writeCodes ? hasPrivilege(user, writeCodes) : false;
  const hasRead = hasPrivilege(user, binding.read) || hasWrite;

  if (mode === "WRITE") {
    if (writeCodes) return hasWrite;
    return hasRead;
  }
  return hasRead;
}
