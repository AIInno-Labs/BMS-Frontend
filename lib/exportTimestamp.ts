/**
 * "23 Aug 2026, 2:45 pm GMT+5:30" — the exporting browser's own local date,
 * time and timezone. Computed client-side rather than where the print HTML
 * is generated, because that happens on the server and has no way to know
 * which timezone the person exporting is actually in. Whatever short form
 * the browser's own `Intl` gives for the timezone is used as-is — a named
 * code like "AEST" where the browser has one, otherwise its offset form
 * like "GMT+5:30" — no manual per-timezone overrides.
 */
export function formatExportTimestamp(): string {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(now);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(now);

  const zoneAbbr =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone;

  return `${datePart}, ${timePart} ${zoneAbbr}`;
}

/** Appends " · {stamp}" to the text of every element matching `selector`. */
export function stampExportTimestamp(doc: Document, selector: string): void {
  const stamp = formatExportTimestamp();
  doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.append(` · ${stamp}`);
  });
}
