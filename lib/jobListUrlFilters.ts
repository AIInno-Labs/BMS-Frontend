export type JobListDuePreset = "any" | "7d" | "1m" | "overdue";

/** ISO yyyy-MM-dd + calendar day delta at local noon. */
export function isoDatePlusDaysFrom(todayIso: string, days: number): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function parseAssignedToParam(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function parseDuePresetParam(raw: string | null): JobListDuePreset {
  if (raw === "7d" || raw === "1m" || raw === "overdue") return raw;
  return "any";
}

/** Maps URL due preset → GET /jobs `dueBefore` (omit when any). */
export function duePresetToDueBefore(
  preset: JobListDuePreset,
  todayIso: string
): string | undefined {
  if (preset === "any") return undefined;
  if (preset === "7d") return isoDatePlusDaysFrom(todayIso, 7);
  if (preset === "1m") return isoDatePlusDaysFrom(todayIso, 30);
  // overdue: dueDate <= yesterday
  return isoDatePlusDaysFrom(todayIso, -1);
}

/**
 * Client keep after `dueBefore` page load.
 * For 7d/1m, drop past-due rows (API upper-bound only).
 * For overdue/any, keep all returned rows.
 */
export function shouldKeepJobForDuePreset(
  preset: JobListDuePreset,
  dueDate: string | null | undefined,
  todayIso: string
): boolean {
  if (preset === "any" || preset === "overdue") return true;
  if (!dueDate) return false;
  return dueDate >= todayIso;
}
