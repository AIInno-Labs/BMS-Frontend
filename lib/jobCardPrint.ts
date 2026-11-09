import type {
  Job,
  JobCardClipRow,
  JobCardPack,
  JobCardPrintDetails,
} from "@/lib/types";
import {
  splitCatalogMaterialGrade,
  splitCatalogSize,
} from "@/lib/frp/inventory-catalog";
import { getWorkerDisplayName } from "@/lib/workers";

export type { JobCardClipRow, JobCardPack, JobCardPrintDetails };

export interface OfficialJobCardData {
  jobNumber: string;
  date: string;
  dueDate: string;
  validUntil: string;
  raisedBy: string;
  customer: string;
  /** Site / postal address from contact details (shown under customer). */
  customerAddress: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  purchaseOrderNo: string;
  accountYesNo: string;
  transport: string;
  transportCompany: string;
  freightAccount: string;
  consignmentNote: string;
  despatchDate: string;
  deliveryDocket: string;
  scopeLines: string[];
  /** Commercial / add-on lines shown on the right of Scope (levy, LOC, warranty…). */
  scopeRightLines: string[];
  scopeType: string;
  thickness: string;
  mesh: string;
  resin: string;
  colour: string;
  finish: string;
  clipRows: JobCardClipRow[];
  notes: string;
  deliveryInstructions: string;
  packs: [JobCardPack, JobCardPack, JobCardPack];
  manufacturingRequired: boolean;
  installRequired: boolean;
  qaCompleted: boolean;
  status: string;
  priority: string;
  assignedWorker: string;
  estimatedHours: string;
  /** Footer version from GET /jobs/{id}/audit totalElements (job audit rows only). */
  jobCardVersion: number;
}

export const STANDARD_CLIP_ROWS: JobCardClipRow[] = [
  { clip: "NO CLIPS REQUIRED", qty: "", packedBy: "" },
  { clip: "Box 25mm M clips", qty: "", packedBy: "" },
  { clip: "Box 38mm M clips", qty: "", packedBy: "" },
  { clip: "Compression clips", qty: "", packedBy: "" },
  { clip: "38mm Square top plate", qty: "", packedBy: "" },
  { clip: "50mm Square top plate", qty: "", packedBy: "" },
  { clip: "W30 Clips", qty: "", packedBy: "" },
  { clip: "W45 Clips", qty: "", packedBy: "" },
  { clip: "W54 Clips", qty: "", packedBy: "" },
  { clip: "Loose 25mm M clip", qty: "", packedBy: "" },
  { clip: "Loose 38mm M clip", qty: "", packedBy: "" },
  { clip: "Loose 50mm M clip", qty: "", packedBy: "" },
  { clip: "C clips 25mm", qty: "", packedBy: "" },
  { clip: "C Clips 38mm", qty: "", packedBy: "" },
  { clip: "OTHER:", qty: "", packedBy: "" },
  { clip: "", qty: "", packedBy: "" },
  { clip: "", qty: "", packedBy: "" },
];

export const PHOTO_CHECKLIST_ROWS = [
  "Grating",
  "Structure",
  "Handrail",
  "Clips",
  "Ladder",
  "Miscellaneous",
] as const;

export const SCOPE_CHECKLIST_ITEMS = [
  "Grating",
  "Treads",
  "Clips",
  "Fasteners",
  "Handrails",
  "Ladders",
  "Structure",
  "Profiles",
  "Design",
  "Drawings",
  "Installation",
  "Cable Ldr",
  "Other",
] as const;

const EMPTY_PACK: JobCardPack = {
  length: "",
  width: "",
  height: "",
  weightKg: "",
};

export function formatJobCardDate(isoDate: string | null | undefined): string {
  const trimmed = isoDate?.trim();
  if (!trimmed) return "—";
  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function nonempty(value?: string | null): string | undefined {
  const v = (value ?? "").trim();
  return v ? v : undefined;
}

/** Footer label: audit length 3 → "Rev 03". */
export function formatJobCardVersionLabel(version: number | null | undefined): string {
  const n = Number.isFinite(version) ? Math.max(0, Math.trunc(version as number)) : 0;
  return `Rev ${String(n).padStart(2, "0")}`;
}

/** Bottom-left print footer: job number plus revision. */
export function formatJobCardIdVersionFooter(
  jobNumber: string,
  version: number | null | undefined
): string {
  const id = (jobNumber ?? "").trim() || "—";
  return `JOB ${id} · ${formatJobCardVersionLabel(version)}`;
}

export function buildOfficialJobCardData(
  job: Job,
  printDetails?: JobCardPrintDetails,
  auditCount = 0
): OfficialJobCardData {
  const pd = printDetails ?? job.printDetails;
  const sl = job.schedulingLogistics;
  const jobNumber = job.id.replace(/^JOB-/, "");

  const materialsList = nonempty(pd?.workflowExtras?.materialsList);
  const fromMaterials = materialsList
    ? materialsList
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const fromCardScope = (pd?.scopeLines ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const fromSelectedItems = (job.selectedItems ?? [])
    .map((item) => {
      const desc =
        (typeof item.description === "string" && item.description) ||
        (typeof item.name === "string" && item.name) ||
        (typeof item.item === "string" && item.item) ||
        "";
      const qty =
        item.quantity != null
          ? String(item.quantity)
          : typeof item.qty === "string" || typeof item.qty === "number"
            ? String(item.qty)
            : "";
      if (!desc.trim()) return "";
      return qty ? `${desc.trim()} × ${qty}` : desc.trim();
    })
    .filter(Boolean);
  // Prefer materials (job_measurements); then card scope; then quote line items;
  // then project name / instructions.
  const allScopeLines = fromMaterials.length
    ? fromMaterials
    : fromCardScope.length
      ? fromCardScope
      : fromSelectedItems.length
        ? fromSelectedItems
        : [
            job.projectName,
            ...(job.manualInstructions
              ? job.manualInstructions.split(/\n+/).filter(Boolean)
              : []),
          ].filter(Boolean);

  const { left: scopeLines, right: scopeRightLines } =
    splitScopeLinesForPrint(allScopeLines);

  // Print inventory from the job Inventory panel — never invent the static
  // STANDARD_CLIP_ROWS catalogue into the export.
  const clipRows = inventoryRowsForPrint(job.inventory);

  const packs = pd?.packs ?? [EMPTY_PACK, EMPTY_PACK, EMPTY_PACK];

  const assignedName = job.assignedWorkerId
    ? getWorkerDisplayName(job.assignedWorkerId)
    : "";
  const raisedBy =
    nonempty(pd?.raisedBy) ??
    (assignedName && assignedName !== "Unassigned"
      ? assignedName
      : undefined) ??
    "";

  const customerAddress =
    nonempty(job.clientAddress) ??
    nonempty(pd?.workflowExtras?.deliveryAddress) ??
    nonempty(sl?.deliveryAddress) ??
    nonempty(sl?.billingAddress) ??
    "";

  return {
    jobNumber,
    date: formatJobCardDate(job.date),
    dueDate: formatJobCardDate(job.dueDate),
    validUntil: formatJobCardDate(job.quoteValidUntil),
    raisedBy,
    customer: job.clientName,
    customerAddress,
    contactName: job.clientContactName || "",
    contactPhone:
      nonempty(pd?.contactPhone) ??
      nonempty(job.printDetails?.contactPhone) ??
      "",
    contactEmail:
      nonempty(pd?.contactEmail) ??
      nonempty(job.printDetails?.contactEmail) ??
      "",
    purchaseOrderNo: nonempty(job.orderNumber) ?? nonempty(pd?.purchaseOrderNo) ?? "",
    accountYesNo: pd?.accountYesNo === false ? "No" : "Yes",
    transport:
      nonempty(pd?.transport) ??
      nonempty(sl?.shipmentMethod) ??
      nonempty(pd?.workflowExtras?.shipmentMethod) ??
      "FRP Engineering",
    transportCompany: nonempty(pd?.transportCompany) ?? "",
    freightAccount:
      nonempty(pd?.freightAccount) ??
      nonempty(sl?.freightAccount) ??
      nonempty(sl?.carrierAccount) ??
      "",
    consignmentNote: nonempty(pd?.consignmentNote) ?? "",
    despatchDate: nonempty(pd?.despatchDate) ?? nonempty(sl?.shipDate) ?? "",
    deliveryDocket: nonempty(pd?.deliveryDocket) ?? "",
    scopeLines,
    scopeRightLines,
    scopeType: nonempty(pd?.scopeType) ?? "",
    thickness: nonempty(pd?.thickness) ?? "",
    mesh: nonempty(pd?.mesh) ?? "",
    resin: job.resinType,
    colour: nonempty(pd?.colour) ?? "",
    finish: nonempty(pd?.finish) ?? "",
    clipRows,
    notes: nonempty(job.notes) ?? "",
    deliveryInstructions:
      nonempty(pd?.deliveryInstructions) ??
      nonempty(pd?.workflowExtras?.deliveryAddress) ??
      nonempty(sl?.deliveryAddress) ??
      (job.installRequired
        ? "Install on site per approved drawing. Confirm delivery docket on arrival."
        : ""),
    packs: [
      packs[0] ?? EMPTY_PACK,
      packs[1] ?? EMPTY_PACK,
      packs[2] ?? EMPTY_PACK,
    ],
    manufacturingRequired: job.manufacturingRequired,
    installRequired: job.installRequired,
    qaCompleted: job.qaCompleted,
    status: job.status,
    priority: job.priority,
    assignedWorker: assignedName,
    estimatedHours: job.estimatedHours != null ? `${job.estimatedHours}h` : "",
    jobCardVersion: auditCount,
  };
}

/** Commercial / add-on lines that belong on the right of Scope of Work. */
const SCOPE_RIGHT_LINE_RE =
  /levy|40\s*\+\s*20|technician|fixing|letter of con|workmanship|warranty|\bloc\b|supplied with goods/i;

/**
 * Split scope lines: product / work description on the left; levy, install,
 * fixings, LOC, warranty (and similar) on the right.
 */
export function splitScopeLinesForPrint(lines: string[]): {
  left: string[];
  right: string[];
} {
  const left: string[] = [];
  const right: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (SCOPE_RIGHT_LINE_RE.test(line)) right.push(line);
    else left.push(line);
  }
  return { left, right };
}

/** Map job.inventory (editable on the job page) → printable column rows. */
export function inventoryRowsForPrint(
  inventory: Job["inventory"] | null | undefined
): JobCardClipRow[] {
  if (!inventory?.length) return [];
  return inventory.map((item) => {
    const { meshSpec, dimension } = splitCatalogSize(item.size ?? "");
    const { resin, colour } = splitCatalogMaterialGrade(item.materialGrade ?? "");
    const productGroup = item.category?.trim() || "";
    const attribute1 = item.profileType?.trim() || "";
    const attribute2 = meshSpec.trim();
    const attribute3 = dimension.trim();
    const resinVal = resin.trim();
    const colourVal = colour.trim();
    const parts = [
      productGroup,
      attribute1,
      attribute2,
      attribute3,
      resinVal,
      colourVal,
    ].filter(Boolean);
    return {
      clip: parts.length ? parts.join(" · ") : "Inventory item",
      productGroup,
      attribute1,
      attribute2,
      attribute3,
      resin: resinVal,
      colour: colourVal,
      qty: item.quantity != null ? String(item.quantity) : "",
      packedBy: "",
    };
  });
}

const EMPTY_INVENTORY_PRINT_ROW: JobCardClipRow = {
  clip: "",
  productGroup: "",
  attribute1: "",
  attribute2: "",
  attribute3: "",
  resin: "",
  colour: "",
  qty: "",
  packedBy: "",
};

/** Blank handwriting rows on the printed job card (beyond saved lines). */
export const INVENTORY_PRINT_BLANK_ROWS = 5;

/**
 * Saved inventory rows plus empty write-in lines so floor staff can add more
 * by hand on the printed card. Always keeps blank space after whatever is saved.
 */
export function padInventoryRowsForPrint(
  rows: JobCardClipRow[],
  blankRows: number = INVENTORY_PRINT_BLANK_ROWS
): { rows: JobCardClipRow[]; blankStartIndex: number } {
  const filled = rows ?? [];
  const extras = Array.from({ length: Math.max(0, blankRows) }, () => ({
    ...EMPTY_INVENTORY_PRINT_ROW,
  }));
  return {
    rows: [...filled, ...extras],
    blankStartIndex: filled.length,
  };
}
