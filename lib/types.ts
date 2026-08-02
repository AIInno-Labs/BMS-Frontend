export type JobStatus =
  | "Pending"
  | "Awaiting Manager Approval"
  | "Ready to Manufacture"
  | "In Fabrication"
  | "On Hold"
  | "Complete"
  | "Cancelled";

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

export interface RequiredInventoryItem {
  label: string;
  qty: string;
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
  requiredInventory?: RequiredInventoryItem[];
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
  /** Supabase UUID (for updates). */
  dbId?: string;
  /** Public job number, e.g. JOB-1001 */
  id: string;
  clientName: string;
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
  manufacturingRequired: boolean;
  installRequired: boolean;
  qaCompleted: boolean;
  clientContactName: string;
  assignedWorkerId: string | null;
  /** Stored in Supabase `assigned_worker_name` */
  assignedWorkerName?: string | null;
  manualInstructions: string;
  printDetails?: JobCardPrintDetails;
  /** ISO timestamp from Supabase `created_at` (for sorting / display). */
  createdAt?: string;
}
