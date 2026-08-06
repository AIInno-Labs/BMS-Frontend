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

export function factoryStatusLabel(status: string | null | undefined): string {
  if (!status) return "No factory job";
  return status;
}

export function isFactoryComplete(
  journeyOutcome: JourneyOutcome,
  factoryJobStatus: string | null | undefined
): boolean {
  return (
    journeyOutcome === "completed" ||
    factoryJobStatus === "Complete" ||
    factoryJobStatus === "Cancelled"
  );
}
