/** Mirrors backend `ProjectRequirement` — same pattern as `FrpPaymentKind`. */
export type ProjectRequirementKind =
  | "DOCUMENTS_REQUIRED"
  | "SAMPLE_REQUIRED"
  | "IGNORE_OVERDUE"
  | "CASH_PAYMENT_REQUIRED"
  // Which path the job takes. Real requirements rather than job-card keys, so
  // "how many supply-only jobs this month" is a question the database can
  // answer. The first four of these also decide which stages apply.
  | "SUPPLY_ONLY"
  | "ORDER_FROM_SUPPLIER_SUPPLY_ONLY"
  | "ORDER_FROM_SUPPLIER_FABRICATION"
  | "PROJECT"
  | "ORDER_PARTS_EXTERNAL"
  | "WARRANTY"
  | "SITE_VISIT_MEASURE"
  | "INSTALLATION";

export const PROJECT_REQUIREMENT_KINDS: ProjectRequirementKind[] = [
  "DOCUMENTS_REQUIRED",
  "SAMPLE_REQUIRED",
  "IGNORE_OVERDUE",
  "CASH_PAYMENT_REQUIRED",
  "SUPPLY_ONLY",
  "ORDER_FROM_SUPPLIER_SUPPLY_ONLY",
  "ORDER_FROM_SUPPLIER_FABRICATION",
  "PROJECT",
  "ORDER_PARTS_EXTERNAL",
  "WARRANTY",
  "SITE_VISIT_MEASURE",
  "INSTALLATION",
];

/**
 * The path flags, in the order the Project Requirements panel lays them out,
 * paired with the `ProjectStageRequirements` key each one mirrors. The panel
 * keeps using those camelCase keys for its own draft state; this is what turns
 * a saved panel into rows the backend can be queried on.
 */
export const STAGE_PATH_REQUIREMENTS: {
  kind: ProjectRequirementKind;
  flag: string;
}[] = [
  { kind: "SUPPLY_ONLY", flag: "supplyOnly" },
  { kind: "ORDER_FROM_SUPPLIER_SUPPLY_ONLY", flag: "orderFromSupplierSupplyOnly" },
  { kind: "ORDER_FROM_SUPPLIER_FABRICATION", flag: "orderFromSupplierFabrication" },
  { kind: "PROJECT", flag: "project" },
  { kind: "ORDER_PARTS_EXTERNAL", flag: "orderPartsExternal" },
  { kind: "WARRANTY", flag: "warranty" },
  { kind: "SITE_VISIT_MEASURE", flag: "siteVisitMeasure" },
  { kind: "INSTALLATION", flag: "installation" },
];

/** Fallback labels when the API row has no `label` (should not happen on detail GET). */
export const PROJECT_REQUIREMENT_LABELS: Record<ProjectRequirementKind, string> = {
  DOCUMENTS_REQUIRED: "Documents required",
  SAMPLE_REQUIRED: "Sample required",
  IGNORE_OVERDUE: "Ignore Overdue",
  CASH_PAYMENT_REQUIRED: "Cash payment required",
  SUPPLY_ONLY: "Supply only",
  ORDER_FROM_SUPPLIER_SUPPLY_ONLY: "Order from Supplier – Supply Only",
  ORDER_FROM_SUPPLIER_FABRICATION: "Order from Supplier – Fabrication",
  PROJECT: "Project",
  ORDER_PARTS_EXTERNAL: "Order Parts (External)",
  WARRANTY: "Warranty",
  SITE_VISIT_MEASURE: "Site Visit / Measure",
  INSTALLATION: "Installation",
};
