/** Mirrors backend `ProjectRequirement` — same pattern as `FrpPaymentKind`. */
export type ProjectRequirementKind =
  | "DOCUMENTS_REQUIRED"
  | "SAMPLE_REQUIRED"
  | "COI_REQUIRED"
  | "CASH_PAYMENT_REQUIRED";

export const PROJECT_REQUIREMENT_KINDS: ProjectRequirementKind[] = [
  "DOCUMENTS_REQUIRED",
  "SAMPLE_REQUIRED",
  "COI_REQUIRED",
  "CASH_PAYMENT_REQUIRED",
];

/** Fallback labels when the API row has no `label` (should not happen on detail GET). */
export const PROJECT_REQUIREMENT_LABELS: Record<ProjectRequirementKind, string> = {
  DOCUMENTS_REQUIRED: "Documents required",
  SAMPLE_REQUIRED: "Sample required",
  COI_REQUIRED: "COI required",
  CASH_PAYMENT_REQUIRED: "Cash payment required",
};
