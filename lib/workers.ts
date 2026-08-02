import type { DbStaffRow } from "@/lib/floorOps";

/** Default worker persona — J. Mitchell (matches seeded staff row). */
export const DEMO_WORKER_ID = "fab-mitchell";

let staffRoster: DbStaffRow[] = [];

export function setStaffRoster(staff: DbStaffRow[]) {
  staffRoster = staff;
}

export function getStaffRoster(): DbStaffRow[] {
  return staffRoster;
}

export function getAssignableWorkers() {
  return staffRoster.filter((s) => s.is_present);
}

export function getWorkerById(id: string | null | undefined) {
  if (!id) return undefined;
  return staffRoster.find((s) => s.id === id);
}

export function getWorkerDisplayName(id: string | null | undefined): string {
  return getWorkerById(id)?.display_name ?? "Unassigned";
}

export function resolveWorkerNameFromId(id: string | null | undefined): string | null {
  return getWorkerById(id)?.display_name ?? null;
}

export function resolveWorkerIdFromName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const exact = staffRoster.find((s) => s.display_name === name.trim());
  if (exact) return exact.id;
  const lastToken = name.trim().split(/\s+/).pop()?.toLowerCase();
  if (!lastToken) return null;
  const fuzzy = staffRoster.find((s) => {
    const parts = s.display_name.toLowerCase().split(/\s+/);
    return parts.some(
      (p) =>
        p.startsWith(lastToken) ||
        lastToken.startsWith(p.replace(".", ""))
    );
  });
  return fuzzy?.id ?? null;
}
