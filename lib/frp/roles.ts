import type { UserDTO } from "@/lib/frp/types";

export type AppRole = "superadmin" | "orgadmin" | "orguser" | "guest";

export function resolveAppRole(user: UserDTO | null | undefined): AppRole {
  if (!user) return "guest";
  if (user.organization == null) return "superadmin";

  const designation = (user.designation ?? "").toUpperCase();
  const roleCodes = (user.roleCodes ?? []).map((c) => c.toUpperCase());
  if (designation === "ORG_ADMIN" || roleCodes.includes("ORG_ADMIN")) {
    return "orgadmin";
  }
  return "orguser";
}

export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "superadmin":
      return "/admin";
    case "orgadmin":
      return "/org";
    case "orguser":
    case "guest":
    default:
      return "/";
  }
}
