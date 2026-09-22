import type { JourneyOutcome } from "@/lib/quotient/quote-types";

export function journeyOutcomeLabel(outcome: JourneyOutcome): string {
  switch (outcome) {
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "accepted":
      return "Accepted";
    default:
      return "Open";
  }
}

/** Backend `FactoryStatus` enum names → display labels. */
const FACTORY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  DRAWING: "Drawing",
  APPROVAL: "Approval",
  PRODUCTION: "Production",
  QC: "QC",
  DISPATCH: "Dispatch",
  COMPLETED: "Completed",
  Complete: "Complete",
  Cancelled: "Cancelled",
};

export function factoryStatusLabel(status: string | null | undefined): string {
  if (!status) return "No factory job";
  return FACTORY_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function isSystemLogged(
  factoryStatus: string | null | undefined
): boolean {
  return factoryStatus != null && String(factoryStatus).trim() !== "";
}

/**
 * Quotient's `progress` field is a CRM pipeline stage the deal owner sets by
 * hand in Quotient itself - our backend copies it verbatim and never derives
 * it (see QuotientEventProcessor.upsertQuotation). That means it can lag the
 * quote's real outcome: a customer can accept or decline before the
 * salesperson moves their own board, so a genuinely accepted quote can still
 * carry "Active", and Quotient's own label for a declined/closed-out quote
 * is "Dismissed", not "Lost".
 *
 * This only affects the DISPLAY label shown next to journey/quote_status -
 * `quote.progress` itself is left alone as the verbatim value from Quotient,
 * since overwriting it would misrepresent what was actually received.
 */
export function progressLabel(
  progress: string | null | undefined,
  journeyOutcome: JourneyOutcome
): string {
  if (journeyOutcome === "declined") return "Dismissed";
  // "Confirmed" for accepted (the deal closed; fabrication may still be
  // ongoing) vs "Completed" for the later, distinct completed journey state
  // (the job itself is done) - reusing one word for both would make an
  // accepted-but-not-yet-fabricated quote look finished when it isn't.
  if (journeyOutcome === "accepted") return "Confirmed";
  if (journeyOutcome === "completed") return "Completed";
  return progress ?? "—";
}

export function isFactoryComplete(
  journeyOutcome: JourneyOutcome,
  factoryJobStatus: string | null | undefined
): boolean {
  return (
    journeyOutcome === "completed" ||
    factoryJobStatus === "Complete" ||
    factoryJobStatus === "COMPLETED" ||
    factoryJobStatus === "Cancelled"
  );
}
