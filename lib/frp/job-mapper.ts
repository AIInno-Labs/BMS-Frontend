/**
 * Mapping between Spring Boot job DTOs and the UI `Job` shape.
 *
 * These interfaces mirror `com.argus.frp.dto.*` exactly — they are the wire
 * format the backend actually serves, per `frp/docs/domain-schema-api.html`
 * Rev 2 §07/§13. Vocabulary translation (status, priority, resin) lives in
 * `./job-status`, not here.
 */

import type { Job, JobCardPrintDetails } from "@/lib/types";
import type { JobOrigin } from "@/lib/frp/job-status";
import {
  priorityToBackend,
  priorityToUi,
  resinToBackend,
  resinToUi,
  statusToBackend,
  statusToUi,
} from "@/lib/frp/job-status";

/* ------------------------------------------------------------ backend DTOs */

/** `JobSummaryDTO` — the list projection. Deliberately excludes `jobCard`. */
export interface FrpJobSummaryDTO {
  id?: number;
  version?: number;
  jobNumber?: string;
  quoteNumber?: string | null;
  origin?: JobOrigin;
  title?: string;
  customerCompanyName?: string;
  dueDate?: string | null;
  stageStatus?: string;
  priority?: string;
  resinCode?: string | null;
  assignedUserId?: number | null;
  percentComplete?: number | null;
  createdDate?: string;
}

/** `JobDTO` — the full record returned by `GET /jobs/{id}`. */
export interface FrpJobDTO {
  id?: number;
  version?: number;
  /** Server-allocated, `READ_ONLY` — supplying it on create is ignored. */
  jobNumber?: string;
  quoteNumber?: string | null;
  /** `READ_ONLY` — derived from whether `quoteNumber` is present. */
  origin?: JobOrigin;
  customerId?: number | null;
  customerCompanyName?: string;
  /** `WRITE_ONLY`, honoured at create only when the company is new. */
  customerContactName?: string;
  customerContactEmail?: string;
  customerContactPhone?: string;
  title?: string;
  dueDate?: string | null;
  /** `READ_ONLY`. Moves only by advancing a stage — see `job-status.ts`. */
  stageStatus?: string;
  priority?: string;
  /** `WRITE_ONLY`, create only. Resolved through `JobStatusLabel`. */
  stageStatusLabel?: string;
  resinCode?: string | null;
  assignedUserId?: number | null;
  estimatedHours?: number | null;
  alert?: string | null;
  /** `READ_ONLY` here — written via `PUT /jobs/{id}/job-card`. */
  jobCard?: FrpJobCardPayload | null;
  createdDate?: string;
  lastModifiedDate?: string;
}

/**
 * The job-card JSON document.
 *
 * Stored as a `jsonb` column and opaque to the backend, which takes it as
 * `Map<String,Object>` — so the frontend owns this schema. Field names follow
 * `bms-api.yaml`'s `JobCardDTO`, which is the better-specified of the two
 * contracts on this particular structure.
 */
export interface FrpJobCardPayload {
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
  /** Not on the backend `Job` entity — carried in the card so it round-trips. */
  dateRaised?: string;
  quoteValidUntil?: string | null;
  manufacturingRequired?: boolean;
  installRequired?: boolean;
  qaCompleted?: boolean;
  manualInstructions?: string;
}

/** `JobCountsDTO` — `GET /jobs/counts`. */
export interface FrpJobCountsDTO {
  total?: number;
  active?: number;
  overdue?: number;
  notStarted?: number;
  awaitingApproval?: number;
  ready?: number;
  manufacturing?: number;
  onHold?: number;
  delivered?: number;
  cancelled?: number;
}

/** `JobAuditHistoryDTO` — append-only business timeline. */
export interface FrpJobAuditHistoryDTO {
  id?: number;
  jobId?: number;
  eventCode?: string;
  statusFrom?: string | null;
  statusTo?: string | null;
  actor?: string | null;
  actorRole?: string | null;
  detail?: Record<string, unknown> | null;
  occurredAt?: string;
}

/** `JobStageDTO` — the stage tree, children nested under their milestone. */
export interface FrpJobStageDTO {
  id?: number;
  parentId?: number | null;
  stageKey?: string;
  stageName?: string;
  stageType?: "MILESTONE" | "OPERATION";
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "SKIPPED" | "BLOCKED";
  sortOrder?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  dependsOnStageId?: number | null;
  assignedTeam?: string | null;
  percentComplete?: number | null;
  children?: FrpJobStageDTO[];
}

export interface FrpJobStageUpdateRequest {
  status?: FrpJobStageDTO["status"];
  percentComplete?: number;
  notes?: string;
  assignedTeam?: string;
}

/**
 * Audit attribution the UI wants to record.
 *
 * The backend derives `eventCode` itself from what changed, so these are
 * carried as the audit `detail` rather than dictating the event.
 */
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

/* ------------------------------------------------------------------ helpers */

function emptyPack() {
  return { length: "", width: "", height: "", weightKg: "" };
}

function packsFromPayload(
  packs?: FrpJobCardPayload["packs"]
): [ReturnType<typeof emptyPack>, ReturnType<typeof emptyPack>, ReturnType<typeof emptyPack>] {
  const at = (i: number) => {
    const p = packs?.[i];
    return {
      length: p?.length ?? "",
      width: p?.width ?? "",
      height: p?.height ?? "",
      weightKg: p?.weightKg ?? "",
    };
  };
  return [at(0), at(1), at(2)];
}

/** Backend `assignedUserId` is a `Long`; the UI carries the id as a string. */
function userIdToUi(id?: number | null): string | null {
  return id == null ? null : String(id);
}

function userIdToBackend(id?: string | null): number | null {
  if (!id) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------- DTO → UI */

/** List row. `jobCard` is absent by design, so print details stay empty. */
export function frpJobSummaryToUi(dto: FrpJobSummaryDTO): Job {
  return {
    dbId: dto.id != null ? String(dto.id) : undefined,
    version: dto.version,
    id: dto.jobNumber ?? "",
    clientName: dto.customerCompanyName ?? "",
    projectName: dto.title ?? "",
    // Date raised. Was hardcoded empty because JobSummaryDTO carried no date
    // at all, which rendered as "Invalid Date" in the list.
    date: dto.createdDate?.slice(0, 10) ?? "",
    dueDate: dto.dueDate ?? null,
    quoteValidUntil: null,
    estimatedHours: null,
    resinType: resinToUi(dto.resinCode),
    status: statusToUi(dto.stageStatus),
    priority: priorityToUi(dto.priority),
    alert: null,
    manufacturingRequired: true,
    installRequired: false,
    qaCompleted: false,
    clientContactName: "",
    assignedWorkerId: userIdToUi(dto.assignedUserId),
    assignedWorkerName: null,
    manualInstructions: "",
    createdAt: dto.createdDate,
    quoteNumber: dto.quoteNumber ?? null,
    origin: dto.origin,
    percentComplete: dto.percentComplete ?? null,
  };
}

/** Full record, including everything carried in the job-card document. */
export function frpJobToUi(dto: FrpJobDTO): Job {
  const card = dto.jobCard ?? undefined;
  const spec = card?.productSpec;

  const printDetails: JobCardPrintDetails = {
    purchaseOrderNo: card?.purchaseOrderNo,
    contactPhone: card?.contactPhone,
    contactEmail: card?.contactEmail,
    accountYesNo: card?.accountCustomer,
    raisedBy: card?.raisedBy,
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
    packs: packsFromPayload(card?.packs),
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
    version: dto.version,
    id: dto.jobNumber ?? "",
    clientName: dto.customerCompanyName ?? "",
    projectName: dto.title ?? "",
    date: card?.dateRaised ?? dto.createdDate?.slice(0, 10) ?? "",
    dueDate: dto.dueDate ?? null,
    quoteValidUntil: card?.quoteValidUntil ?? null,
    estimatedHours: dto.estimatedHours ?? null,
    // Resin lives on the job row, not the card — the card mirrors it for print.
    resinType: resinToUi(dto.resinCode),
    status: statusToUi(dto.stageStatus),
    priority: priorityToUi(dto.priority),
    alert: dto.alert ?? null,
    manufacturingRequired: card?.manufacturingRequired ?? true,
    installRequired: card?.installRequired ?? false,
    qaCompleted: card?.qaCompleted ?? false,
    // Contact name is not readable back: `customerContactName` is WRITE_ONLY on
    // JobDTO and lives on CustomerContact, which has no endpoint yet.
    clientContactName: "",
    assignedWorkerId: userIdToUi(dto.assignedUserId),
    assignedWorkerName: null,
    manualInstructions: card?.manualInstructions ?? "",
    printDetails,
    createdAt: dto.createdDate,
    customerId: dto.customerId ?? null,
    quoteNumber: dto.quoteNumber ?? null,
    origin: dto.origin,
  };
}

/* ------------------------------------------------------------- UI → DTO */

/**
 * `POST /jobs`.
 *
 * `jobNumber` is sent when the operator supplied one — the create drawer
 * pre-fills a suggestion and lets it be amended. Omitting it hands allocation
 * to `SequenceGeneratorService`. It is ignored for quote-derived jobs, which
 * are always `JOB-Q-{quoteNumber}`.
 *
 * Uniqueness is the backend's call: it is enforced per organization by
 * `uk_job_org_job_number` and surfaces as a 409, because the number the drawer
 * suggests is derived from the jobs this browser happens to have loaded.
 *
 * The customer is resolved by the backend — `resolveOrCreateCustomer` matches
 * on company name and creates the company plus its first contact when there is
 * no match. There is no `/customers` endpoint to call first.
 */
export function uiJobToCreateRequest(job: Job): FrpJobDTO {
  return {
    jobNumber: job.id?.trim() || undefined,
    quoteNumber: job.quoteNumber || undefined,
    customerId: job.customerId ?? undefined,
    customerCompanyName: job.clientName || undefined,
    customerContactName: job.clientContactName || undefined,
    customerContactEmail: job.printDetails?.contactEmail || undefined,
    customerContactPhone: job.printDetails?.contactPhone || undefined,
    title: job.projectName,
    dueDate: job.dueDate ?? undefined,
    priority: priorityToBackend(job.priority),
    // Write-only, create only. Backend defaults to PENDING when absent.
    stageStatusLabel: statusToBackend(job.status) ?? undefined,
    resinCode: resinToBackend(job.resinType),
    assignedUserId: userIdToBackend(job.assignedWorkerId) ?? undefined,
    estimatedHours: job.estimatedHours ?? undefined,
    alert: job.alert ?? undefined,
  };
}

/**
 * `PUT /jobs` — the id and the optimistic-lock token travel in the body.
 *
 * `stageStatus` is omitted on purpose. It is `READ_ONLY` and recomputed by the
 * stage service; status changes go through `advanceJobStatus` instead.
 */
export function uiJobToUpdateRequest(job: Job): FrpJobDTO {
  if (job.dbId == null) {
    throw new Error(`Job ${job.id} has no database id — cannot update.`);
  }
  if (job.version == null) {
    throw new Error(
      `Job ${job.id} has no version — refresh before saving, or the backend will reject the write.`
    );
  }
  return {
    id: Number(job.dbId),
    version: job.version,
    quoteNumber: job.quoteNumber ?? undefined,
    customerId: job.customerId ?? undefined,
    customerCompanyName: job.clientName || undefined,
    title: job.projectName,
    dueDate: job.dueDate ?? undefined,
    priority: priorityToBackend(job.priority),
    resinCode: resinToBackend(job.resinType),
    assignedUserId: userIdToBackend(job.assignedWorkerId),
    estimatedHours: job.estimatedHours ?? undefined,
    alert: job.alert ?? undefined,
  };
}

/**
 * The job-card document for `PUT /jobs/{id}/job-card?version=`.
 *
 * Fields the `Job` entity has no column for — `dateRaised`, `quoteValidUntil`,
 * the three workflow flags, `manualInstructions` — ride along here so they
 * round-trip. Rev 2 §07 lists `manufacturingRequired` / `installRequired` /
 * `qaCompleted` on the entity, but `JobDTO` does not expose them, so the API
 * cannot carry them today. Move them out of the card once the DTO does.
 */
export function uiJobToJobCardPayload(job: Job): FrpJobCardPayload {
  const pd = job.printDetails;
  const extras = pd?.workflowExtras;
  const packs = pd?.packs ?? [emptyPack(), emptyPack(), emptyPack()];

  return {
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
    paymentReceived: extras?.paymentReceived ?? null,
    paymentDueDate: extras?.paymentDueDate,
    dateRaised: job.date || undefined,
    quoteValidUntil: job.quoteValidUntil,
    manufacturingRequired: job.manufacturingRequired,
    installRequired: job.installRequired,
    qaCompleted: job.qaCompleted,
    manualInstructions: job.manualInstructions || undefined,
  };
}
