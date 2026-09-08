/**
 * Privilege catalog types — must match backend `com.argus.frp.Enum.PrivilegeType`.
 *
 * There is no `VIEW` privilege type. Navigation/visibility for screens is
 * `MENU`. `VIEW` only appears as a naming suggestion in some docs for FIELD
 * *codes*; the stored FIELD access mode is `READ` | `WRITE`.
 */

export const PRIVILEGE_TYPES = ["ACTION", "MENU", "FIELD"] as const;

export type PrivilegeType = (typeof PRIVILEGE_TYPES)[number];

export const FIELD_ACCESS_MODES = ["READ", "WRITE"] as const;

export type FieldAccessMode = (typeof FIELD_ACCESS_MODES)[number];

/** Creatable via POST /privileges (ACTION is system-synced). */
export const API_CREATABLE_PRIVILEGE_TYPES = ["MENU", "FIELD"] as const;

export type ApiCreatablePrivilegeType =
  (typeof API_CREATABLE_PRIVILEGE_TYPES)[number];

export function isPrivilegeType(value: unknown): value is PrivilegeType {
  return (
    typeof value === "string" &&
    (PRIVILEGE_TYPES as readonly string[]).includes(value)
  );
}

export const PRIVILEGE_CODE_HINT: Record<ApiCreatablePrivilegeType, string> = {
  MENU: "Must match MENU_{DOMAIN}[_ITEM], e.g. MENU_JOBS",
  FIELD:
    "Must match FIELD_{DOMAIN}_{FIELD}_…, e.g. FIELD_JOB_UNIT_PRICE_READ. Access mode is READ or WRITE (not a separate privilege type).",
};
