import type { AnyJobStatus } from "@/lib/jobStatus";

/**
 * Widened during the DEL-01 status-model migration.
 *
 * Accepts both the canonical PRD lifecycle and the seven legacy states so
 * existing call sites keep compiling while new work targets the canonical
 * model. Import the precise unions (`JobStatus`, `LegacyJobStatus`) from
 * `@/lib/jobStatus` directly when you need to exclude one or the other.
 */
export type JobStatus = AnyJobStatus;

export type {
  AnyJobStatus,
  JobExceptionStatus,
  LegacyJobStatus,
} from "@/lib/jobStatus";

export type ResinType =
  | "Isophthalic Polyester"
  | "Vinyl Ester"
  | "Phenolic";

export type JobPriority = "Normal" | "High" | "RUSH";

export interface JobCardClipRow {
  clip: string;
  qty: string;
  packedBy: string;
}

export interface JobCardPack {
  length: string;
  width: string;
  height: string;
  weightKg: string;
}

export interface JobMaterialRow {
  material: string;
  qty: string;
  availability: string;
}

/** Extended job-card fields (serialized in pack_dimensions JSON). */
export interface JobWorkflowExtras {
  documentsRequired?: boolean;
  sampleRequired?: boolean;
  coiRequired?: boolean;
  jobType?: string;
  projectedStartDate?: string;
  productionStatus?: string;
  responsibleParty?: string;
  accountable?: string;
  shipmentMethod?: string;
  carrierAccount?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  materialsList?: string;
  materialRows?: JobMaterialRow[];
  customFields?: string[];
  programHistory?: string[];
  additionalNotes?: string;
  resinMatQty?: string;
  fiberRollQty?: string;
  jobCardNotes?: string;
  /** `true` = Yes, `false` = No, `null` = not set */
  paymentReceived?: boolean | null;
  paymentDueDate?: string;
}

export interface JobCardPrintDetails {
  purchaseOrderNo?: string;
  contactPhone?: string;
  contactEmail?: string;
  accountYesNo?: boolean;
  raisedBy?: string;
  transport?: string;
  transportCompany?: string;
  freightAccount?: string;
  consignmentNote?: string;
  despatchDate?: string;
  deliveryDocket?: string;
  scopeType?: string;
  thickness?: string;
  mesh?: string;
  colour?: string;
  finish?: string;
  clipRows?: JobCardClipRow[];
  deliveryInstructions?: string;
  packs?: [JobCardPack, JobCardPack, JobCardPack];
  scopeLines?: string[];
  workflowExtras?: JobWorkflowExtras;
}

export interface Job {
  /**
   * Spring Boot job primary key (stringified).
   *
   * Every write path addresses the job by this, not by `id` — the backend
   * routes are `/jobs/{id}` with a numeric `@PathVariable Long`.
   */
  dbId?: string;
  /** Public job number, e.g. JOB-1001. Server-allocated, read-only. */
  id: string;
  clientName: string;
  /** From `contactDetails.address` when present. */
  clientAddress?: string;
  projectName: string;
  date: string;
  /** Factory due date — set manually on the job card. */
  dueDate: string | null;
  /** Quotient `valid_until` — read-only, from accepted quote. */
  quoteValidUntil: string | null;
  estimatedHours: number | null;
  resinType: ResinType;
  status: JobStatus;
  priority: JobPriority;
  alert: string | null;
  /** Free working notes on the job. Distinct from the short `alert` flag. */
  notes: string | null;
  /** What the job is, in prose. Distinct from notes. */
  description?: string | null;
  /** Kind of work (`JobType`). Null on jobs raised before the field existed. */
  jobType?: string | null;
  manufacturingRequired: boolean;
  installRequired: boolean;
  qaCompleted: boolean;
  clientContactName: string;
  assignedWorkerId: string | null;
  /** Assigned worker display name (`assignedTo` on Spring Boot). */
  assignedWorkerName?: string | null;
  /** Quote owner's name (e.g. a Quotient salesperson); may have no user. */
  ownerName?: string | null;
  /** Customer order/PO number, from a Quotient acceptance. */
  orderNumber?: string | null;
  /** The quote's line items (Quotient `selected_items`), verbatim. */
  measurement?: Array<Record<string, unknown>> | null;
  /** ISO 4217 code from the originating quote's payload, if any. */
  currency?: string | null;
  manualInstructions: string;
  /** How and when the job ships — one row per job, saved on the job. */
  schedulingLogistics?: JobSchedulingLogistics | null;
  printDetails?: JobCardPrintDetails;
  /** ISO timestamp from Spring Boot `createdDate`. */
  createdAt?: string;
  /** Set for quote-derived jobs; drives `origin` on the backend. */
  quoteNumber?: string | null;
  /** `QUOTE` when raised from a quote, `FACTORY` when raised in-house. */
  origin?: "QUOTE" | "FACTORY";
  /** Stage-tree completion, served on the list projection only. */
  percentComplete?: number | null;
  /** Furthest milestone that's complete or active, e.g. `"design"`. `READ_ONLY`. */
  currentStageKey?: string | null;
  /** Material lines for the job (backend `inventory` table). Inline on `GET
   *  /jobs/{id}`; mutated via `/jobs/{id}/inventory`. */
  inventory?: JobInventoryLine[];
}

/** One row of the job's material/inventory table (`InventoryDTO`). */
export interface JobInventoryLine {
  id?: number;
  category?: string | null;
  profileType?: string | null;
  size?: string | null;
  materialGrade?: string | null;
  /** Integer; backend `InventoryDTO.quantity` is never negative. */
  quantity?: number | null;
  description?: string | null;
}

export type ShipmentMethod =
  | "INHOUSE_DELIVERY"
  | "CUSTOMER_COLLECT"
  | "THIRD_PARTY_COURIER"
  | "FREIGHT_FORWARDER"
  | "OTHER";

/**
 * How and when one job ships. One-to-one with the job. `jobStatus` is a local
 * logistics status (raw backend value) — it does not move the job's stage.
 */
export interface JobSchedulingLogistics {
  jobStatus: string | null;
  responsiblePersonId: number | null;
  accountable: string | null;
  contactId: number | null;
  shipDate: string | null;
  shipmentMethod: ShipmentMethod | null;
  freightAccount: string | null;
  carrierAccount: string | null;
  billingAddress: string | null;
  deliveryAddress: string | null;
}
