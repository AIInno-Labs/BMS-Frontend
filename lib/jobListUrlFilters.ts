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

/**
 * A `yyyy-MM-dd` URL parameter, or undefined when absent or malformed.
 *
 * Validated rather than passed through: the value goes straight into a request
 * the API rejects on a bad date, and a hand-edited or stale URL should quietly
 * drop the filter rather than break the page.
 *
 * The round-trip through Date catches what the regex cannot — `2026-02-31`
 * matches the shape but rolls over to March, so it is not a real date.
 */
export function parseDueDateParam(raw: string | null): string | undefined {
  if (raw == null) return undefined;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return undefined;
  }
  return value;
}
