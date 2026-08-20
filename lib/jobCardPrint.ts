import type {
  Job,
  JobCardClipRow,
  JobCardPack,
  JobCardPrintDetails,
} from "@/lib/types";
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
  /** Footer version from audit-history length (`GET /jobs/{id}.auditVersion`). */
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

/** Footer label: audit length 3 → "Job Card 03". */
export function formatJobCardVersionLabel(version: number | null | undefined): string {
  const n = Number.isFinite(version) ? Math.max(0, Math.trunc(version as number)) : 0;
  return `Job Card ${String(n).padStart(2, "0")}`;
}

export function buildOfficialJobCardData(
  job: Job,
  printDetails?: JobCardPrintDetails
): OfficialJobCardData {
  const pd = printDetails ?? job.printDetails;
  const sl = job.schedulingLogistics;
  const jobNumber = job.id.replace(/^JOB-/, "");

  const fromCardScope = (pd?.scopeLines ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const scopeLines = fromCardScope.length
    ? fromCardScope
    : [
        job.projectName,
        ...(job.manualInstructions
          ? job.manualInstructions.split(/\n+/).filter(Boolean)
          : []),
      ].filter(Boolean);

  const clipRows =
    pd?.clipRows && pd.clipRows.length > 0
      ? mergeClipRows(pd.clipRows)
      : STANDARD_CLIP_ROWS;

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
    purchaseOrderNo: nonempty(pd?.purchaseOrderNo) ?? "",
    accountYesNo: pd?.accountYesNo === false ? "No" : "Yes",
    transport: nonempty(pd?.transport) ?? "FRP Engineering",
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
    scopeType: nonempty(pd?.scopeType) ?? "",
    thickness: nonempty(pd?.thickness) ?? "",
    mesh: nonempty(pd?.mesh) ?? "",
    resin: job.resinType,
    colour: nonempty(pd?.colour) ?? "",
    finish: nonempty(pd?.finish) ?? "",
    clipRows,
    notes:
      nonempty(pd?.workflowExtras?.jobCardNotes) ?? nonempty(job.notes) ?? "",
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
    jobCardVersion: job.auditVersion ?? 0,
  };
}

function mergeClipRows(custom: JobCardClipRow[]): JobCardClipRow[] {
  const map = new Map(custom.map((r) => [r.clip.toLowerCase(), r]));
  return STANDARD_CLIP_ROWS.map((row) => {
    const hit = map.get(row.clip.toLowerCase());
    return hit ? { ...row, ...hit } : row;
  });
}
