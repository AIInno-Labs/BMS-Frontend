import type { Job, JobCardPrintDetails, JobPriority, JobStatus, ResinType } from "@/lib/types";

/** Backend JobDTO shape (matches BMS-backend JobDTO + JobCardDTO). */
export interface FrpJobDTO {
  id?: number;
  jobNumber?: string;
  jobName?: string;
  quotientQuoteId?: string | null;
  customer?: {
    id?: number;
    name?: string;
    contactName?: string;
    email?: string;
    phone?: string;
  } | null;
  status?: string;
  priority?: string;
  needsJobCard?: boolean;
  installRequired?: boolean;
  qaCompleted?: boolean;
  dateRaised?: string;
  dueDate?: string | null;
  quoteValidUntil?: string | null;
  estimatedHours?: number | null;
  raisedBy?: string;
  assignedTo?: string | null;
  alert?: string | null;
  description?: string | null;
  jobCard?: FrpJobCardDTO | null;
  createdDate?: string;
  lastModifiedDate?: string;
}

export interface FrpJobCardDTO {
  purchaseOrderNo?: string;
  contactPhone?: string;
  contactEmail?: string;
  accountCustomer?: boolean;
  raisedBy?: string;
  transport?: string;
  transportCompany?: string;
  freightAccount?: string;
  consignmentNote?: string;
  despatchDate?: string;
  deliveryDocket?: string;
  deliveryInstructions?: string;
  productSpec?: {
    constructionType?: string;
    productCategory?: string;
    meshSize?: string;
    thicknessMm?: string;
    resinType?: string;
    finishType?: string;
    colour?: string;
    nosingColour?: string;
  } | null;
  scopeLines?: string[];
  clipRows?: { clip?: string; qty?: string; packedBy?: string }[];
  packs?: { length?: string; width?: string; height?: string; weightKg?: string }[];
  materialRows?: { material?: string; qty?: string; availability?: string }[];
  shipmentMethod?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  programHistory?: string[];
  notes?: string;
  additionalNotes?: string;
  documentsRequired?: boolean;
  sampleRequired?: boolean;
  coiRequired?: boolean;
  paymentReceived?: boolean | null;
  paymentDueDate?: string;
}

export interface FrpCustomerDTO {
  id?: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  accountType?: "CASH" | "ACCOUNT";
  notifyOnStatusChange?: boolean;
}

export interface FrpCreateJobRequest {
  jobNumber?: string;
  jobName: string;
  customerId: number;
  status?: string;
  priority?: string;
  needsJobCard: boolean;
  installRequired?: boolean;
  qaCompleted?: boolean;
  dateRaised: string;
  dueDate?: string;
  estimatedHours?: number;
  assignedTo?: string;
  description?: string;
}

export interface FrpUpdateJobRequest {
  jobName?: string;
  customerId?: number;
  status?: string;
  priority?: string;
  needsJobCard?: boolean;
  installRequired?: boolean;
  qaCompleted?: boolean;
  dueDate?: string | null;
  estimatedHours?: number | null;
  assignedTo?: string | null;
  alert?: string | null;
  description?: string | null;
  jobCard?: FrpJobCardDTO;
  auditAction?: string;
  auditDetail?: string | null;
}

export interface FrpJobAuditEntryDTO {
  id?: number;
  jobNumber?: string;
  action?: string;
  detail?: string;
  performedBy?: string;
  performedAt?: string;
}

export type JobUpdateAuditAction =
  | false
  | "job_card_saved"
  | "alert_cleared"
  | "ai_estimate"
  | "payment_updated"
  | "status_changed"
  | "assignment_changed"
  | "qa_signed_off"
  | "note_added";

const DEFAULT_RESIN: ResinType = "Isophthalic Polyester";
const DEFAULT_PRIORITY: JobPriority = "Normal";

function asResin(value?: string | null): ResinType {
  if (
    value === "Isophthalic Polyester" ||
    value === "Vinyl Ester" ||
    value === "Phenolic"
  ) {
    return value;
  }
  return DEFAULT_RESIN;
}

function asPriority(value?: string | null): JobPriority {
  if (value === "Normal" || value === "High" || value === "RUSH") return value;
  return DEFAULT_PRIORITY;
}

function emptyPack() {
  return { length: "", width: "", height: "", weightKg: "" };
}

function packsFromDto(
  packs?: FrpJobCardDTO["packs"]
): [ReturnType<typeof emptyPack>, ReturnType<typeof emptyPack>, ReturnType<typeof emptyPack>] {
  const a = packs?.[0];
  const b = packs?.[1];
  const c = packs?.[2];
  return [
    {
      length: a?.length ?? "",
      width: a?.width ?? "",
      height: a?.height ?? "",
      weightKg: a?.weightKg ?? "",
    },
    {
      length: b?.length ?? "",
      width: b?.width ?? "",
      height: b?.height ?? "",
      weightKg: b?.weightKg ?? "",
    },
    {
      length: c?.length ?? "",
      width: c?.width ?? "",
      height: c?.height ?? "",
      weightKg: c?.weightKg ?? "",
    },
  ];
}

export function frpJobToUi(dto: FrpJobDTO): Job {
  const card = dto.jobCard;
  const spec = card?.productSpec;
  const printDetails: JobCardPrintDetails = {
    purchaseOrderNo: card?.purchaseOrderNo,
    contactPhone: card?.contactPhone ?? dto.customer?.phone,
    contactEmail: card?.contactEmail ?? dto.customer?.email,
    accountYesNo: card?.accountCustomer,
    raisedBy: card?.raisedBy ?? dto.raisedBy,
    transport: card?.transport,
    transportCompany: card?.transportCompany,
    freightAccount: card?.freightAccount,
    consignmentNote: card?.consignmentNote,
    despatchDate: card?.despatchDate,
    deliveryDocket: card?.deliveryDocket,
    scopeType: spec?.constructionType,
    thickness: spec?.thicknessMm,
    mesh: spec?.meshSize,
    colour: spec?.colour,
    finish: spec?.finishType,
    clipRows: (card?.clipRows ?? []).map((r) => ({
      clip: r.clip ?? "",
      qty: r.qty ?? "",
      packedBy: r.packedBy ?? "",
    })),
    deliveryInstructions: card?.deliveryInstructions,
    packs: packsFromDto(card?.packs),
    scopeLines: card?.scopeLines ?? [],
    workflowExtras: {
      documentsRequired: card?.documentsRequired,
      sampleRequired: card?.sampleRequired,
      coiRequired: card?.coiRequired,
      shipmentMethod: card?.shipmentMethod,
      billingAddress: card?.billingAddress,
      deliveryAddress: card?.deliveryAddress,
      materialRows: (card?.materialRows ?? []).map((m) => ({
        material: m.material ?? "",
        qty: m.qty ?? "",
        availability: m.availability ?? "",
      })),
      programHistory: card?.programHistory ?? [],
      additionalNotes: card?.additionalNotes,
      jobCardNotes: card?.notes,
      paymentReceived: card?.paymentReceived ?? null,
      paymentDueDate: card?.paymentDueDate,
    },
  };

  return {
    dbId: dto.id != null ? String(dto.id) : undefined,
    id: dto.jobNumber ?? "",
    clientName: dto.customer?.name ?? "",
    projectName: dto.jobName ?? "",
    date: dto.dateRaised ?? "",
    dueDate: dto.dueDate ?? null,
    quoteValidUntil: dto.quoteValidUntil ?? null,
    estimatedHours: dto.estimatedHours ?? null,
    resinType: asResin(spec?.resinType),
    status: (dto.status as JobStatus) ?? "Pending",
    priority: asPriority(dto.priority),
    alert: dto.alert ?? null,
    manufacturingRequired: dto.needsJobCard ?? true,
    installRequired: dto.installRequired ?? false,
    qaCompleted: dto.qaCompleted ?? false,
    clientContactName: dto.customer?.contactName ?? "",
    assignedWorkerId: null,
    assignedWorkerName: dto.assignedTo ?? null,
    manualInstructions: dto.description ?? "",
    printDetails,
    createdAt: dto.createdDate,
  };
}

export function uiJobToUpdateRequest(
  job: Job,
  audit?: JobUpdateAuditAction,
  auditDetail?: string | null
): FrpUpdateJobRequest {
  const pd = job.printDetails;
  const extras = pd?.workflowExtras;
  const packs = pd?.packs ?? [emptyPack(), emptyPack(), emptyPack()];

  const body: FrpUpdateJobRequest = {
    jobName: job.projectName,
    status: job.status,
    priority: job.priority,
    needsJobCard: job.manufacturingRequired,
    installRequired: job.installRequired,
    qaCompleted: job.qaCompleted,
    dueDate: job.dueDate,
    estimatedHours: job.estimatedHours,
    assignedTo: job.assignedWorkerName ?? job.assignedWorkerId,
    alert: job.alert,
    description: job.manualInstructions,
    jobCard: {
      purchaseOrderNo: pd?.purchaseOrderNo,
      contactPhone: pd?.contactPhone,
      contactEmail: pd?.contactEmail,
      accountCustomer: pd?.accountYesNo,
      raisedBy: pd?.raisedBy,
      transport: pd?.transport,
      transportCompany: pd?.transportCompany,
      freightAccount: pd?.freightAccount,
      consignmentNote: pd?.consignmentNote,
      despatchDate: pd?.despatchDate,
      deliveryDocket: pd?.deliveryDocket,
      deliveryInstructions: pd?.deliveryInstructions,
      productSpec: {
        constructionType: pd?.scopeType,
        thicknessMm: pd?.thickness,
        meshSize: pd?.mesh,
        colour: pd?.colour,
        finishType: pd?.finish,
        resinType: job.resinType,
      },
      scopeLines: pd?.scopeLines,
      clipRows: pd?.clipRows,
      packs: [...packs],
      materialRows: extras?.materialRows,
      shipmentMethod: extras?.shipmentMethod,
      billingAddress: extras?.billingAddress,
      deliveryAddress: extras?.deliveryAddress,
      programHistory: extras?.programHistory,
      notes: extras?.jobCardNotes,
      additionalNotes: extras?.additionalNotes,
      documentsRequired: extras?.documentsRequired,
      sampleRequired: extras?.sampleRequired,
      coiRequired: extras?.coiRequired,
      paymentReceived: extras?.paymentReceived ?? undefined,
      paymentDueDate: extras?.paymentDueDate,
    },
  };

  if (audit !== undefined && audit !== false) {
    body.auditAction = audit;
    if (auditDetail !== undefined) body.auditDetail = auditDetail;
  }

  return body;
}

export function uiJobToCreateRequest(
  job: Job,
  customerId: number
): FrpCreateJobRequest {
  return {
    jobNumber: job.id || undefined,
    jobName: job.projectName,
    customerId,
    status: job.status,
    priority: job.priority,
    needsJobCard: job.manufacturingRequired,
    installRequired: job.installRequired,
    qaCompleted: job.qaCompleted,
    dateRaised: job.date || new Date().toISOString().slice(0, 10),
    dueDate: job.dueDate ?? undefined,
    estimatedHours: job.estimatedHours ?? undefined,
    assignedTo: job.assignedWorkerName ?? job.assignedWorkerId ?? undefined,
    description: job.manualInstructions || undefined,
  };
}
