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
  NOTIFICATIONS_VIEW: "NOTIFICATIONS_VIEW",
  JOB_CHAT_VIEW: "JOB_CHAT_VIEW",
  JOB_CHAT_SEND: "JOB_CHAT_SEND",
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
  SECURITY: "MENU_SECURITY",
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
  MFA: "mfa",
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
  [FIELD_KEYS.MFA, { read: FIELD_CODES.SECURITY_MFA }],
]);

/**
 * UI access key → privilege code(s) that grant it.
 *
 * Nav/view keys prefer MENU_* (assignable by Org Admin from the Super Admin
 * catalog). ACTION codes remain as OR fallbacks so existing roles that only
 * have JOB_READ / QUOTE_READ keep working until MENU grants are rolled out.
 *
 * Create/update still map to ACTION — those are API privileges enforced by
 * the backend interceptor (see PRIVILEGE_MODEL.md).
 */
export const ACCESS_PRIVILEGE_MAP: Map<AccessKey, string | readonly string[]> =
  new Map<AccessKey, string | readonly string[]>([
    [
      ACCESS_KEYS.DASHBOARD_VIEW,
      [MENU_CODES.DASHBOARD, MENU_CODES.JOBS, "JOB_READ"],
    ],
    [ACCESS_KEYS.JOBS_VIEW, [MENU_CODES.JOBS, "JOB_READ"]],
    [ACCESS_KEYS.JOBS_CREATE, "JOB_CREATE"],
    [ACCESS_KEYS.JOBS_UPDATE, "JOB_UPDATE"],
    [ACCESS_KEYS.QUOTES_VIEW, [MENU_CODES.QUOTES, "QUOTE_READ"]],
    [
      ACCESS_KEYS.ANALYTICS_VIEW,
      [MENU_CODES.ANALYTICS, MENU_CODES.DASHBOARD, "JOB_READ"],
    ],
    // No ACTION equivalent for these two — MENU_QUOTIENT/MENU_SECURITY must be
    // assigned explicitly by Org Admin (see CreateRoleDrawer) for a custom role
    // to see them; there's no ACTION fallback to fail open on like the keys above.
    [ACCESS_KEYS.QUOTIENT_VIEW, MENU_CODES.QUOTIENT],
    [ACCESS_KEYS.SECURITY_VIEW, MENU_CODES.SECURITY],
    // Chat/notifications reuse the existing MESSAGE_READ/MESSAGE_CREATE ACTION
    // codes rather than new ones (see ChatController/NotificationController,
    // both @PrivilegedResource("MESSAGE")) — real backend enforcement, so
    // these keys just mirror it on the frontend to avoid dead-end UI (bell/
    // chat visible, then a 403 the moment it fetches).
    [ACCESS_KEYS.NOTIFICATIONS_VIEW, "MESSAGE_READ"],
    [ACCESS_KEYS.JOB_CHAT_VIEW, "MESSAGE_READ"],
    [ACCESS_KEYS.JOB_CHAT_SEND, "MESSAGE_CREATE"],
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
