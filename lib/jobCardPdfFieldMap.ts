import {
  STANDARD_CLIP_ROWS,
  type OfficialJobCardData,
} from "@/lib/jobCardPrint";
import type { Job, JobCardClipRow, JobCardPack } from "@/lib/types";

/** Where a pdf.html field is persisted in the Spring Boot job model. */
export type JobCardFieldStorage =
  | { kind: "db"; column: string }
  | { kind: "json"; path: string; column?: "pack_dimensions" }
  | { kind: "derived"; source: string }
  | { kind: "manual"; reason: string };

export type JobCardFieldSection =
  | "header"
  | "qa"
  | "notice"
  | "scope"
  | "photos"
  | "notes"
  | "delivery";

export interface JobCardPdfFieldDef {
  /** Stable id used by HTML renderer (`data-jc`). */
  id: string;
  section: JobCardFieldSection;
  /** Label printed on the paper form. */
  label: string;
  /** Path on `OfficialJobCardData` when wired. */
  officialKey?: keyof OfficialJobCardData;
  /** Dot path on `Job` (e.g. `printDetails.contactPhone`). */
  jobPath?: string;
  storage: JobCardFieldStorage;
  /** Shown in the job card UI / saved via PATCH. */
  editableInApp: boolean;
  /** Populated by `buildOfficialJobCardData` today. */
  wired: boolean;
  notes?: string;
}

/** Clip rows on the paper form — shared with `STANDARD_CLIP_ROWS`. */
export const PDF_CLIP_ROW_LABELS = STANDARD_CLIP_ROWS.map(
  (row) => row.clip
);

/** Photo checklist rows — shop-floor manual completion only. */
export const PDF_PHOTO_CHECKLIST_ROWS = [
  "Grating",
  "Structure",
  "Handrail",
  "Clips",
  "Ladder",
  "Miscellaneous",
] as const;

/**
 * Complete map of every fillable cell/area on `pdf.html` → database / app fields.
 * Use this when wiring export, forms, or new persistence.
 */
export const JOB_CARD_PDF_FIELD_MAP: JobCardPdfFieldDef[] = [
  // ── Header metadata ──────────────────────────────────────────────
  {
    id: "jobNumber",
    section: "header",
    label: "Job #",
    officialKey: "jobNumber",
    jobPath: "id",
    storage: { kind: "db", column: "jobs.id" },
    editableInApp: false,
    wired: true,
    notes: "Strips JOB- prefix for display.",
  },
  {
    id: "date",
    section: "header",
    label: "Date",
    officialKey: "date",
    jobPath: "date",
    storage: { kind: "db", column: "jobs.date_raised" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "dueDate",
    section: "header",
    label: "Due Date",
    officialKey: "dueDate",
    jobPath: "dueDate",
    storage: { kind: "db", column: "jobs.due_date" },
    editableInApp: true,
    wired: true,
    notes: "Factory due date (manual). Rendered red on PDF.",
  },
  {
    id: "raisedBy",
    section: "header",
    label: "Raised by",
    officialKey: "raisedBy",
    jobPath: "printDetails.raisedBy",
    storage: { kind: "db", column: "jobs.raised_by" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "customer",
    section: "header",
    label: "Customer",
    officialKey: "customer",
    jobPath: "clientName",
    storage: { kind: "db", column: "jobs.customer_name" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "customerAddress",
    section: "header",
    label: "Address",
    officialKey: "customerAddress",
    jobPath: "clientAddress",
    storage: { kind: "db", column: "job_contact_details.address" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "contactName",
    section: "header",
    label: "Contact Name",
    officialKey: "contactName",
    jobPath: "clientContactName",
    storage: { kind: "db", column: "jobs.client_contact_name" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "contactPhone",
    section: "header",
    label: "Contact Number",
    officialKey: "contactPhone",
    jobPath: "printDetails.contactPhone",
    storage: { kind: "json", path: "contactPhone", column: "pack_dimensions" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "contactEmail",
    section: "header",
    label: "Contact Email",
    officialKey: "contactEmail",
    jobPath: "printDetails.contactEmail",
    storage: { kind: "json", path: "contactEmail", column: "pack_dimensions" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "purchaseOrderNo",
    section: "header",
    label: "Purchase Order No.",
    officialKey: "purchaseOrderNo",
    jobPath: "printDetails.purchaseOrderNo",
    storage: { kind: "json", path: "purchaseOrderNo", column: "pack_dimensions" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "accountYesNo",
    section: "header",
    label: "Account Y / N",
    officialKey: "accountYesNo",
    jobPath: "printDetails.accountYesNo",
    storage: { kind: "json", path: "accountYesNo", column: "pack_dimensions" },
    editableInApp: true,
    wired: true,
    notes: "Boolean in app; prints Yes/No.",
  },
  {
    id: "transport",
    section: "header",
    label: "Transport",
    officialKey: "transport",
    jobPath: "printDetails.transport",
    storage: { kind: "json", path: "transport", column: "pack_dimensions" },
    editableInApp: true,
    wired: true,
    notes: "No dedicated DB column; defaults to FRP Engineering.",
  },
  {
    id: "transportCompany",
    section: "header",
    label: "Transport Company",
    officialKey: "transportCompany",
    jobPath: "printDetails.transportCompany",
    storage: { kind: "db", column: "jobs.transport_company" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "freightAccount",
    section: "header",
    label: "Account #",
    officialKey: "freightAccount",
    jobPath: "printDetails.freightAccount",
    storage: { kind: "db", column: "jobs.freight_account_number" },
    editableInApp: true,
    wired: true,
    notes: "Label on page 2 React PDF: Freight Account #.",
  },
  {
    id: "consignmentNote",
    section: "header",
    label: "Consignment Note #",
    officialKey: "consignmentNote",
    jobPath: "printDetails.consignmentNote",
    storage: { kind: "db", column: "jobs.consignment_note_number" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "despatchDate",
    section: "header",
    label: "Despatch Date",
    officialKey: "despatchDate",
    jobPath: "printDetails.despatchDate",
    storage: { kind: "db", column: "jobs.despatch_date" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "deliveryDocket",
    section: "header",
    label: "Delivery Docket #",
    officialKey: "deliveryDocket",
    jobPath: "printDetails.deliveryDocket",
    storage: { kind: "db", column: "jobs.delivery_docket_number" },
    editableInApp: true,
    wired: true,
  },

  // ── QA sign-off ──────────────────────────────────────────────────
  {
    id: "qaName",
    section: "qa",
    label: "QA Name",
    officialKey: "assignedWorker",
    jobPath: "assignedWorkerId",
    storage: { kind: "derived", source: "qa_completed + assigned_worker_name" },
    editableInApp: false,
    wired: true,
    notes: "Only filled when qaCompleted is true.",
  },
  {
    id: "qaSign",
    section: "qa",
    label: "QA Sign",
    storage: { kind: "manual", reason: "Physical signature on paper" },
    editableInApp: false,
    wired: false,
  },
  {
    id: "qaDate",
    section: "qa",
    label: "QA Date",
    storage: { kind: "manual", reason: "Signed on paper at QA completion" },
    editableInApp: false,
    wired: false,
  },

  // ── Scope ────────────────────────────────────────────────────────
  {
    id: "scopeLines",
    section: "scope",
    label: "Scope of work (free text)",
    officialKey: "scopeLines",
    jobPath: "printDetails.scopeLines",
    storage: { kind: "json", path: "scopeLines", column: "pack_dimensions" },
    editableInApp: true,
    wired: true,
    notes: "Falls back to project_name + manual_instructions lines.",
  },
  {
    id: "scopeType",
    section: "scope",
    label: "Type",
    officialKey: "scopeType",
    jobPath: "printDetails.scopeType",
    storage: { kind: "db", column: "jobs.product_category" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "thickness",
    section: "scope",
    label: "Thickness",
    officialKey: "thickness",
    jobPath: "printDetails.thickness",
    storage: { kind: "db", column: "jobs.thickness_mm" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "mesh",
    section: "scope",
    label: "Mesh",
    officialKey: "mesh",
    jobPath: "printDetails.mesh",
    storage: { kind: "db", column: "jobs.mesh_size" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "resin",
    section: "scope",
    label: "Resin",
    officialKey: "resin",
    jobPath: "resinType",
    storage: { kind: "db", column: "jobs.resin_type" },
    editableInApp: true,
    wired: true,
    notes: "Normalized to UI label via resinDbToUi.",
  },
  {
    id: "colour",
    section: "scope",
    label: "Colour",
    officialKey: "colour",
    jobPath: "printDetails.colour",
    storage: { kind: "db", column: "jobs.colour" },
    editableInApp: true,
    wired: true,
  },
  {
    id: "finish",
    section: "scope",
    label: "Finish",
    officialKey: "finish",
    jobPath: "printDetails.finish",
    storage: { kind: "db", column: "jobs.finish_type" },
    editableInApp: true,
    wired: true,
  },

  // Clip rows (qty + packedBy per row)
  ...PDF_CLIP_ROW_LABELS.flatMap((clip, index) => [
    {
      id: `clip.${index}.qty`,
      section: "scope" as const,
      label: `${clip} — QTY`,
      jobPath: `printDetails.clipRows[${index}].qty`,
      storage: {
        kind: "json" as const,
        path: `clipRows[${index}].qty`,
        column: "pack_dimensions" as const,
      },
      editableInApp: true,
      wired: true,
    },
    {
      id: `clip.${index}.packedBy`,
      section: "scope" as const,
      label: `${clip} — Packed by`,
      jobPath: `printDetails.clipRows[${index}].packedBy`,
      storage: {
        kind: "json" as const,
        path: `clipRows[${index}].packedBy`,
        column: "pack_dimensions" as const,
      },
      editableInApp: true,
      wired: true,
    },
  ]),

  // ── Photos / bolts (manual shop-floor) ───────────────────────────
  ...PDF_PHOTO_CHECKLIST_ROWS.flatMap((row, index) => [
    {
      id: `photo.${index}.initial`,
      section: "photos" as const,
      label: `${row} — Initial`,
      storage: { kind: "manual" as const, reason: "Shop-floor photo checklist" },
      editableInApp: false,
      wired: false,
    },
    {
      id: `photo.${index}.date`,
      section: "photos" as const,
      label: `${row} — Date`,
      storage: { kind: "manual" as const, reason: "Shop-floor photo checklist" },
      editableInApp: false,
      wired: false,
    },
  ]),
  ...Array.from({ length: 6 }, (_, index) => [
    {
      id: `bolt.${index}.size`,
      section: "photos" as const,
      label: `Bolt row ${index + 1} — size`,
      storage: { kind: "manual" as const, reason: "Bolt list completed on paper" },
      editableInApp: false,
      wired: false,
    },
    {
      id: `bolt.${index}.qty`,
      section: "photos" as const,
      label: `Bolt row ${index + 1} — QTY`,
      storage: { kind: "manual" as const, reason: "Bolt list completed on paper" },
      editableInApp: false,
      wired: false,
    },
    {
      id: `bolt.${index}.date`,
      section: "photos" as const,
      label: `Bolt row ${index + 1} — Date`,
      storage: { kind: "manual" as const, reason: "Bolt list completed on paper" },
      editableInApp: false,
      wired: false,
    },
    {
      id: `bolt.${index}.initial`,
      section: "photos" as const,
      label: `Bolt row ${index + 1} — Initial`,
      storage: { kind: "manual" as const, reason: "Bolt list completed on paper" },
      editableInApp: false,
      wired: false,
    },
  ]).flat(),

  // ── Notes ────────────────────────────────────────────────────────
  {
    id: "notes",
    section: "notes",
    label: "NOTES",
    officialKey: "notes",
    jobPath: "printDetails.workflowExtras.jobCardNotes",
    storage: {
      kind: "json" as const,
      path: "workflowExtras.jobCardNotes",
      column: "pack_dimensions" as const,
    },
    editableInApp: true,
    wired: true,
  },

  // ── Delivery ─────────────────────────────────────────────────────
  ...([0, 1, 2] as const).flatMap((packIndex) =>
    (["length", "width", "height", "weightKg"] as const).map((dim) => ({
      id: `pack.${packIndex}.${dim}`,
      section: "delivery" as const,
      label: `PACK ${packIndex + 1} — ${dim}`,
      jobPath: `printDetails.packs[${packIndex}].${dim}`,
      storage: {
        kind: "json" as const,
        path: `packs[${packIndex}].${dim}`,
        column: "pack_dimensions" as const,
      },
      editableInApp: true,
      wired: true,
    }))
  ),
  {
    id: "deliveryInstructions",
    section: "delivery",
    label: "Delivery instructions",
    officialKey: "deliveryInstructions",
    jobPath: "printDetails.deliveryInstructions",
    storage: { kind: "db" as const, column: "jobs.delivery_instructions" },
    editableInApp: true,
    wired: true,
  },
];

/** DB columns present in schema but not yet on the paper PDF / Job type. */
export const JOB_CARD_UNMAPPED_DB_FIELDS = [
  {
    column: "jobs.construction_type",
    notes: "In DB + JOB_SELECT; not in Job type or pdf.html.",
  },
  {
    column: "jobs.nosing_colour",
    notes: "In DB; shown on React page 2 workshop table only.",
  },
  {
    column: "jobs.supervisor_signature",
    notes: "Schema column; unused.",
  },
  {
    column: "jobs.signed_at",
    notes: "Schema column; unused.",
  },
  {
    column: "jobs.quote_valid_until",
    jobPath: "quoteValidUntil",
    notes: "In OfficialJobCardData.validUntil but not rendered on pdf.html.",
  },
] as const;

export function getJobCardFieldsBySection(
  section: JobCardFieldSection
): JobCardPdfFieldDef[] {
  return JOB_CARD_PDF_FIELD_MAP.filter((f) => f.section === section);
}

export function getUnwiredJobCardFields(): JobCardPdfFieldDef[] {
  return JOB_CARD_PDF_FIELD_MAP.filter((f) => !f.wired);
}

/** Flat string map for HTML templating (`data-jc` ids → display value). */
export function officialDataToFieldValues(
  data: OfficialJobCardData
): Record<string, string> {
  const values: Record<string, string> = {
    jobNumber: blankDash(data.jobNumber),
    jobNumberWatermark: blankDash(data.jobNumber),
    date: blankDash(data.date),
    dueDate: blankDash(data.dueDate),
    raisedBy: blankDash(data.raisedBy),
    customer: blankDash(data.customer),
    customerAddress: blankDash(data.customerAddress),
    contactName: blankDash(data.contactName),
    contactPhone: blankDash(data.contactPhone),
    contactEmail: blankDash(data.contactEmail),
    purchaseOrderNo: blankDash(data.purchaseOrderNo),
    accountYesNo: blankDash(data.accountYesNo),
    transport: blankDash(data.transport),
    transportCompany: blankDash(data.transportCompany),
    freightAccount: blankDash(data.freightAccount),
    consignmentNote: blankDash(data.consignmentNote),
    despatchDate: blankDash(data.despatchDate),
    deliveryDocket: blankDash(data.deliveryDocket),
    scopeType: blankDash(data.scopeType),
    thickness: blankDash(data.thickness),
    mesh: blankDash(data.mesh),
    resin: blankDash(data.resin),
    colour: blankDash(data.colour),
    finish: blankDash(data.finish),
    notes: blankDash(data.notes),
    deliveryInstructions: blankDash(data.deliveryInstructions),
    qaName: data.qaCompleted ? blankDash(data.assignedWorker) : "",
    qaSign: "",
    qaDate: "",
    scopeLines: data.scopeLines.filter(Boolean).join("<br>"),
  };

  data.clipRows.forEach((row: JobCardClipRow, index: number) => {
    values[`clip.${index}.qty`] = blankDash(row.qty);
    values[`clip.${index}.packedBy`] = blankDash(row.packedBy);
  });

  data.packs.forEach((pack: JobCardPack, packIndex: number) => {
    values[`pack.${packIndex}.length`] = blankDash(pack.length);
    values[`pack.${packIndex}.width`] = blankDash(pack.width);
    values[`pack.${packIndex}.height`] = blankDash(pack.height);
    values[`pack.${packIndex}.weightKg`] = blankDash(pack.weightKg);
  });

  return values;
}

function blankDash(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  return v === "—" ? "" : v;
}
