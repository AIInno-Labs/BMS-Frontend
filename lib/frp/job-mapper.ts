/**
 * Mapping between Spring Boot job DTOs and the UI `Job` shape.
 *
 * These interfaces mirror `com.argus.frp.dto.*` exactly — they are the wire
 * format the backend actually serves, per `frp/docs/domain-schema-api.html`
 * Rev 2 §07/§13. Vocabulary translation (status, priority, resin) lives in
 * `./job-status`, not here.
 */

import type {
  Job,
  JobCardPrintDetails,
  JobInventoryLine,
  JobProjectRequirement,
  JobSchedulingLogistics,
  ShipmentMethod,
} from "@/lib/types";
import type { JobOrigin } from "@/lib/frp/job-status";
import {
  PROJECT_REQUIREMENT_KINDS,
  PROJECT_REQUIREMENT_LABELS,
  type ProjectRequirementKind,
} from "@/lib/frp/project-requirements";
import {
  combineCatalogMaterialGrade,
  combineCatalogSize,
} from "@/lib/frp/inventory-catalog";
import {
  priorityToBackend,
  priorityToUi,
  resinToBackend,
  resinToUi,
  jobTypeToBackend,
  jobTypeToUi,
  statusToBackend,
  statusToUi,
} from "@/lib/frp/job-status";

/* ------------------------------------------------------------ backend DTOs */

/** `JobSummaryDTO` — the list projection. Deliberately excludes `jobCard`. */
export interface FrpJobSummaryDTO {
  id?: number;
  jobNumber?: string;
  quoteNumber?: string | null;
  origin?: JobOrigin;
  projectName?: string;
  customerCompanyName?: string;
  dueDate?: string | null;
  stageStatus?: string;
  priority?: string;
  /** `JobType` enum name. Null on jobs raised before the field existed. */
  jobType?: string | null;
  resinCode?: string | null;
  assignedUserId?: number | null;
  /** Quote owner's name; present even when no matching user (id then null). */
  ownerName?: string | null;
  /** Free working notes; shown as a preview in the list. */
  notes?: string | null;
  percentComplete?: number | null;
  /** Furthest milestone that's complete or active, e.g. `"design"`. `READ_ONLY`. */
  currentStageKey?: string | null;
  createdDate?: string;
}

/** `JobDTO` — the full record returned by `GET /jobs/{id}`. */
export interface FrpJobDTO {
  id?: number;
  /** Server-allocated, `READ_ONLY` — supplying it on create is ignored. */
  jobNumber?: string;
  quoteNumber?: string | null;
  /** `READ_ONLY` — derived from whether `quoteNumber` is present. */
  origin?: JobOrigin;
  /** Denormalised from the contact details, for the list and for search. */
  customerCompanyName?: string;
  /** One row per job — company and contact together. */
  contactDetails?: FrpJobContactDetailsDTO | null;
  schedulingLogistics?: FrpJobSchedulingLogisticsDTO | null;
  projectName?: string;
  dueDate?: string | null;
  /** `READ_ONLY`. Moves only by advancing a stage — see `job-status.ts`. */
  stageStatus?: string;
  priority?: string;
  /** `WRITE_ONLY`, create only. Resolved through `JobStatusLabel`. */
  stageStatusLabel?: string;
  /** `READ_ONLY` — furthest milestone that's complete or active, e.g. `"design"`. */
  currentStageKey?: string | null;
  /** `READ_ONLY` — id of the current milestone. Present on create. */
  currentStageId?: number | null;
  /** `READ_ONLY` — stage tree. Present on `GET /jobs/{id}`; may be absent on create. */
  stages?: FrpJobStageDTO[];
  resinCode?: string | null;
  assignedUserId?: number | null;
  /** Quote owner's name; present even when no matching user (id then null). */
  ownerName?: string | null;
  /** Customer order/PO number, captured from a Quotient acceptance. */
  orderNumber?: string | null;
  /** Raw source payload the job was raised from (e.g. the Quotient webhook). */
  payload?: Record<string, unknown> | null;
  /** The quote's selected items (Quotient `selected_items`), verbatim. */
  selectedItems?: Array<Record<string, unknown>> | null;
  estimatedHours?: number | null;
  alert?: string | null;
  /** Free working notes, saved through the normal job update. Distinct from
   *  the short `alert` flag; print-only text stays in `jobCard`. */
  notes?: string | null;
  /** What the job is, in prose. Distinct from notes. */
  description?: string | null;
  /** `JobType` enum name. Null on jobs raised before the field existed. */
  jobType?: string | null;
  /** Currency for the payment totalled from `selectedItems`, e.g. `INR`. Sent on
   *  create and update; returned by `GET /jobs/{id}` off the payment it was
   *  stored on. Absent from the list view, which does not load payments. */
  currency?: string | null;
  /** `READ_ONLY` here — written via `PUT /jobs/{id}/job-card`. */
  jobCard?: FrpJobCardPayload | null;
  /**
   * `READ_ONLY` — materials & specifications (`job_measurements`).
   * Written via `PUT /jobs/{id}/measurements`.
   */
  measurements?: FrpJobMeasurementDTO | null;
  createdDate?: string;
  lastModifiedDate?: string;
  /** `READ_ONLY`, detail view only (`GET /jobs/{id}`) — resolved `customerId` row. */
  customer?: FrpCustomerDTO | null;
  /** `READ_ONLY` — mutated via `PUT /jobs/{id}/payment`. */
  payments?: FrpJobPaymentDTO[];
  /** `READ_ONLY` here, detail view only (`GET /jobs/{id}`) — mutated via
   *  `/jobs/{id}/job-inventory`. */
  inventory?: FrpJobInventoryDTO[];
    /** `READ_ONLY` — all requirement kinds (Documents / Sample / COI / Cash payment). */
    requirements?: FrpJobProjectRequirementDTO[];
}

/** `JobProjectRequirementDTO` — one project requirement row. */
export interface FrpJobProjectRequirementDTO {
  requirementName?: ProjectRequirementKind;
  label?: string;
  isRequired?: boolean | null;
  remarks?: string | null;
  updatedBy?: number | null;
  updatedAt?: string | null;
}

/** `MasterInventoryDTO` — one row of the org catalogue. */
export interface FrpMasterInventoryDTO {
  id?: number;
  productGroup?: string;
  attribute1?: string | null;
  attribute2?: string | null;
  attribute3?: string | null;
  material?: string | null;
  primaryColour?: string | null;
  createdBy?: number | null;
}

/** `JobInventoryDTO` — a job's use of a master-inventory item. Nested on
 *  `JobDTO` in the detail view and addressable through
 *  `/jobs/{id}/job-inventory`. */
export interface FrpJobInventoryDTO {
  id?: number;
  masterInventoryId?: number;
  quantity?: number | null;
  /** The referenced catalogue item, populated on read. */
  master?: FrpMasterInventoryDTO | null;
}

/** `CustomerDTO` — nested on `JobDTO` in the detail view. */
export interface FrpCustomerDTO {
  id?: number;
  companyId?: number | null;
  companyName?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  details?: string | null;
}

/** `CustomerContactDTO` — nested on `JobDTO` in the detail view. */
export interface FrpCustomerContactDTO {
  id?: number;
  customerId?: number;
  companyId?: number | null;
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  details?: string | null;
}

/**
 * `JobContactDetailsDTO` — who ONE job is for.
 *
 * There is no company master behind this: the same company on two jobs is two
 * rows, so editing one cannot change what the other shows.
 */
export interface FrpJobContactDetailsDTO {
  id?: number;
  jobId?: number;
  /** The customer's own business code. Free text, not a foreign key. */
  companyId?: string | null;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  details?: Record<string, unknown> | null;
  updatedBy?: number | null;
}

/**
 * `JobSchedulingLogisticsDTO` — how and when ONE job ships. One-to-one with the
 * job; `jobStatus` is a local logistics status, not the job's stage status.
 */
export interface FrpJobSchedulingLogisticsDTO {
  id?: number;
  jobId?: number;
  jobStatus?: string | null;
  responsiblePersonId?: number | null;
  accountable?: string | null;
  contactId?: number | null;
  shipDate?: string | null;
  shipmentMethod?: string | null;
  freightAccount?: string | null;
  carrierAccount?: string | null;
  billingAddress?: string | null;
  deliveryAddress?: string | null;
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
  materialsList?: string;
  shipmentMethod?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  programHistory?: string[];
  notes?: string;
  additionalNotes?: string;
  /** @deprecated Use `job_project_requirements` via `JobDTO.requirements`. */
  documentsRequired?: boolean;
  /** @deprecated Use `job_project_requirements` via `JobDTO.requirements`. */
  sampleRequired?: boolean;
  /** @deprecated Use `job_project_requirements` via `JobDTO.requirements`. */
  coiRequired?: boolean;
  /** @deprecated Payment lives on `job_payment`; kept to read older cards. */
  paymentReceived?: boolean | null;
  /** @deprecated Payment lives on `job_payment`; kept to read older cards. */
  paymentDueDate?: string;
  /** Not on the backend `Job` entity — carried in the card so it round-trips. */
  dateRaised?: string;
  quoteValidUntil?: string | null;
  manufacturingRequired?: boolean;
  installRequired?: boolean;
  qaCompleted?: boolean;
  manualInstructions?: string;
}

/** One resin category from `GET /jobs/resin-counts`. */
export interface FrpJobResinCountDTO {
  resinCode?: string | null;
  label?: string;
  count?: number;
}

/** `JobResinCountsDTO` — `GET /jobs/resin-counts`. */
export interface FrpJobResinCountsDTO {
  total?: number;
  byResin?: FrpJobResinCountDTO[];
}

/** `JobMeasurementDTO` — materials & specifications (`job_measurements`). */
export interface FrpJobMeasurementDTO {
  id?: number;
  jobId?: number;
  /** Free-form JSON; UI stores `{ materialsList: string }`. */
  materials?: Record<string, unknown> | null;
  notes?: string | null;
  createdBy?: number | null;
  createdDate?: string | null;
  lastModifiedBy?: number | null;
  lastModifiedDate?: string | null;
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
  /** User id string, or a machine actor such as `system:quotient`. */
  actor?: string | null;
  /** Resolved when `actor` is a numeric user id. */
  actorUser?: FrpAssignedUserDTO | null;
  actorRole?: string | null;
  detail?: Record<string, unknown> | null;
  occurredAt?: string;
}

/** Lightweight assignee on a stage response. */
export interface FrpAssignedUserDTO {
  id?: number;
  displayName?: string | null;
  email?: string | null;
  username?: string | null;
}

/** `JobStageDTO` — the stage tree, children nested under their milestone. */
export interface FrpJobStageDTO {
  id?: number;
  parentId?: number | null;
  stageKey?: string;
  stageName?: string;
  stageType?: "MILESTONE" | "OPERATION";
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "SKIPPED" | "BLOCKED";
  /** Whether this stage requires a document before it completes.
   *  Seeded from the stage template default, editable per job. */
  docRequired?: boolean;
  sortOrder?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  dependsOnStageId?: number | null;
  /** Comma-joined user ids (write / storage mirror). */
  assignedTeam?: string | null;
  /** Resolved assignees from `assignedTeam`. */
  assignees?: FrpAssignedUserDTO[];
  percentComplete?: number | null;
  children?: FrpJobStageDTO[];
  /** Documents uploaded against this stage — populated server-side on every
   *  `GET /jobs/{id}/stages` and stage PUT/scan response. */
  documents?: FrpJobDocumentDTO[];
  /** Who last touched this stage row (raw user id) — resolve via a users
   *  lookup (e.g. `listUsers`), same as `getQcSignoff` does. */
  lastModifiedBy?: number | null;
}

/** Who signed off QC, and when — for the Letter of Compliance. */
export interface QcSignoff {
  name: string | null;
  occurredAt: string | null;
}

/**
 * Finds the QC sign-off from the job's stage tree: the `qc` milestone's
 * `signoff` child operation (QA Sign-off — the last of `qc`'s three
 * children: `visual`, `dimensional`, `signoff`; see the `"qc"` entry in
 * `JobStageServiceImpl`'s stage-template map). `stages` is the top-level
 * milestone list from `GET /jobs/{id}` (`dto.stages`) — `signoff` is
 * nested under `qc`'s own `children`, not a top-level entry.
 *
 * Date comes from the stage's own `completedAt`. Name is resolved from the
 * stage's raw `lastModifiedBy` user id via `usersById` — a plain
 * `id -> displayName` lookup built from the existing `GET /users` endpoint
 * (`listUsers`), the same source the app already uses elsewhere (e.g. the
 * "Responsible party" picker) to turn a user id into a name.
 */
export function getQcSignoff(
  stages: FrpJobStageDTO[] | null | undefined,
  usersById: Record<number, string>
): QcSignoff {
  const qc = stages?.find((s) => s.stageKey === "qc");
  const signoff = qc?.children?.find((c) => c.stageKey === "signoff");
  const modifiedBy = signoff?.lastModifiedBy;
  return {
    name: (modifiedBy != null ? usersById[modifiedBy] : undefined) ?? null,
    occurredAt: signoff?.completedAt ?? null,
  };
}

export interface FrpJobStageUpdateRequest {
  status?: FrpJobStageDTO["status"];
  percentComplete?: number;
  notes?: string;
  /** Toggle whether this stage requires a document. Editable per stage. */
  docRequired?: boolean;
  assignedTeam?: string;
}

/** Document category — mirrors backend `DocumentType` (milestone-derived). */
export type FrpDocumentType = "DRAWING" | "PRODUCTION" | "QC" | "OTHER";

/** Review status on a job document — mirrors backend `Status`. */
export type FrpDocumentStatus = "ACTIVE" | "ACCEPTED" | "REJECTED";

/** OCR/LLM pipeline — mirrors backend `DocumentExtractionStatus`. */
export type FrpDocumentExtractionStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "READY"
  | "FAILED"
  | "SKIPPED";

/** SharePoint bytes — mirrors backend `DocumentStorageStatus`. */
export type FrpDocumentStorageStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "STORED"
  | "FAILED";

export type FrpDocumentSort = "RECENT" | "ALL";

/** `JobDocumentDTO` — a document attached to a job / stage. */
export interface FrpJobDocumentDTO {
  id?: number;
  jobId?: number;
  jobStageId?: number;
  documentName?: string;
  documentType?: FrpDocumentType;
  milestoneStageId?: number;
  milestoneStageKey?: string;
  milestoneStageName?: string;
  mimeType?: string;
  sizeBytes?: number;
  documentData?: Record<string, unknown> | null;
  editedDocumentData?: Record<string, unknown> | null;
  remarks?: string | null;
  documentVersion?: number;
  status?: FrpDocumentStatus;
  extractionStatus?: FrpDocumentExtractionStatus;
  /** Reason for the current extractionStatus: the failure message on FAILED, null on READY. */
  extractionMessage?: string | null;
  /** SharePoint upload — PENDING until the async worker stores or fails. */
  storageStatus?: FrpDocumentStorageStatus;
  uploadedBy?: number;
  uploadedAt?: string;
  modifiedBy?: number;
  modifiedAt?: string;
}

/** One row in `PoComparisonDTO.fields` (Field / Quote / This PO). */
export interface FrpPoComparisonFieldDTO {
  /** `Order`, `Item 1`…, or `Totals`. */
  group?: string;
  field?: string;
  quote?: string;
  thisPo?: string;
  variance?: boolean;
  /** `SOURCE_CODE` | `DESCRIPTION` | `POSITION` | `UNMATCHED` — line items only. */
  matchedBy?: string;
  quoteLineIndex?: number | null;
  poLineIndex?: number | null;
}

/** `GET /jobs/{jobId}/documents/{documentId}/compare` — PRODUCTION docs only. */
export interface FrpPoComparisonDTO {
  jobId?: number;
  documentId?: number;
  documentType?: FrpDocumentType;
  documentName?: string;
  status?: FrpDocumentStatus;
  documentVersion?: number;
  versionDate?: string;
  latest?: boolean;
  /** e.g. `v3 · 2026-08-05 (latest)` */
  versionLabel?: string;
  editable?: boolean;
  conclusion?: string;
  notes?: string | null;
  needsReview?: boolean;
  fields?: FrpPoComparisonFieldDTO[];
  jobData?: Record<string, unknown> | null;
  extractedData?: Record<string, unknown> | null;
  documentData?: Record<string, unknown> | null;
  editedDocumentData?: Record<string, unknown> | null;
}

export type FrpPaymentKind = "DEPOSIT" | "PROGRESS" | "FINAL";
export type FrpPaymentStatus = "DUE" | "RECEIVED" | "OVERDUE" | "WRITTEN_OFF";
export type FrpPaymentMode = "CASH" | "ACCOUNT";

/** `JobPaymentDTO` — nested on `GET /jobs/{id}` and returned by payment PUT. */
export interface FrpJobPaymentDTO {
  id?: number;
  jobId?: number;
  quoteNumber?: string;
  amount?: number;
  currency?: string;
  kind?: FrpPaymentKind;
  status?: FrpPaymentStatus;
  paymentMode?: FrpPaymentMode;
  dueDate?: string;
  receivedAt?: string;
  reference?: string;
  recordedBy?: number;
}

/**
 * `PUT /jobs/{id}/payment` — null fields are left unchanged.
 * `paid: true` → RECEIVED, `paid: false` → DUE.
 * `estimatedDate` maps to `job_payment.due_date` (`yyyy-MM-dd`).
 */
export interface FrpJobPaymentUpdateRequest {
  paid?: boolean;
  estimatedDate?: string;
  paymentMode?: FrpPaymentMode;
}

/** `PUT /documents/{id}` — only non-null fields are applied. */
export interface FrpJobDocumentUpdateRequest {
  documentName?: string;
  remarks?: string | null;
  status?: FrpDocumentStatus;
  documentData?: Record<string, unknown> | null;
  editedDocumentData?: Record<string, unknown> | null;
}

/** One line on `POST /jobs/{jobId}/documents/po`. */
export interface FrpManualPoLineItemRequest {
  sourceCode?: string;
  description?: string;
  quantity?: number;
  /** Per-unit price. Server stores it as `unitPrice`. */
  price?: number;
  /** Left off so the server derives `quantity × price`. */
  lineTotal?: number;
}

/**
 * `POST /jobs/{jobId}/documents/po` — hand-keyed PO, no file / OCR / LLM.
 * Stage must resolve to a production milestone.
 */
export interface FrpManualPoRequest {
  jobStageId: number;
  documentName?: string;
  orderNo?: string;
  /** `yyyy-MM-dd` */
  orderDate?: string;
  /** `yyyy-MM-dd` */
  expectedDate?: string;
  buyerName?: string;
  supplierName?: string;
  quoteNumber?: string;
  currency?: string;
  remarks?: string;
  lineItems?: FrpManualPoLineItemRequest[];
}

/** `GET /documents/{id}/download` — short-lived signed SharePoint URL. */
export interface FrpDocumentDownloadDTO {
  id?: number;
  downloadUrl?: string;
  expiresAt?: string;
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

export function userIdToBackend(id?: string | null): number | null {
  if (!id) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/** Prefer FINAL; otherwise the first row — same rule as backend `pickJobPayment`. */
function pickJobPayment(
  payments?: FrpJobPaymentDTO[] | null
): FrpJobPaymentDTO | undefined {
  if (!payments?.length) return undefined;
  return payments.find((p) => p.kind === "FINAL") ?? payments[0];
}

function paymentReceivedFromStatus(
  status?: FrpPaymentStatus
): boolean | null {
  if (status === "RECEIVED") return true;
  if (status == null) return null;
  return false;
}

/* ------------------------------------------------------------- DTO → UI */

/** List row. `jobCard` is absent by design, so print details stay empty. */
export function frpJobSummaryToUi(dto: FrpJobSummaryDTO): Job {
  return {
    dbId: dto.id != null ? String(dto.id) : undefined,
    id: dto.jobNumber ?? "",
    clientName: dto.customerCompanyName ?? "",
    projectName: dto.projectName ?? "",
    // Date raised. Was hardcoded empty because JobSummaryDTO carried no date
    // at all, which rendered as "Invalid Date" in the list.
    date: dto.createdDate?.slice(0, 10) ?? "",
    dueDate: dto.dueDate ?? null,
    quoteValidUntil: null,
    estimatedHours: null,
    resinType: resinToUi(dto.resinCode),
    status: statusToUi(dto.stageStatus),
    priority: priorityToUi(dto.priority),
    jobType: jobTypeToUi(dto.jobType),
    alert: null,
    notes: dto.notes ?? null,
    ownerName: dto.ownerName ?? null,
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
    currentStageKey: dto.currentStageKey ?? null,
  };
}

/** Scheduling & logistics is near pass-through — both sides use raw backend
 *  enum values, so there is nothing to translate. */
function schedulingLogisticsToUi(
  dto: FrpJobSchedulingLogisticsDTO | null | undefined
): JobSchedulingLogistics | null {
  if (!dto) return null;
  return {
    jobStatus: dto.jobStatus ?? null,
    responsiblePersonId: dto.responsiblePersonId ?? null,
    accountable: dto.accountable ?? null,
    contactId: dto.contactId ?? null,
    shipDate: dto.shipDate ?? null,
    shipmentMethod: (dto.shipmentMethod ?? null) as ShipmentMethod | null,
    freightAccount: dto.freightAccount ?? null,
    carrierAccount: dto.carrierAccount ?? null,
    billingAddress: dto.billingAddress ?? null,
    deliveryAddress: dto.deliveryAddress ?? null,
  };
}

/** The contact-details body the job carries in its flat fields. Shared by the
 *  create request (folded in) and the dedicated PUT /jobs/{id}/contact-details. */
export function uiJobToContactDetails(job: Job): FrpJobContactDetailsDTO {
  return {
    companyName: job.clientName || undefined,
    contactName: job.clientContactName || undefined,
    email: job.printDetails?.contactEmail || undefined,
    phone: job.printDetails?.contactPhone || undefined,
    address: job.clientAddress || undefined,
  };
}

export function schedulingLogisticsToBackend(
  sl: JobSchedulingLogistics | null | undefined
): FrpJobSchedulingLogisticsDTO | undefined {
  if (!sl) return undefined;
  return {
    jobStatus: sl.jobStatus ?? undefined,
    responsiblePersonId: sl.responsiblePersonId ?? undefined,
    accountable: sl.accountable ?? undefined,
    contactId: sl.contactId ?? undefined,
    shipDate: sl.shipDate ?? undefined,
    shipmentMethod: sl.shipmentMethod ?? undefined,
    freightAccount: sl.freightAccount ?? undefined,
    carrierAccount: sl.carrierAccount ?? undefined,
    billingAddress: sl.billingAddress ?? undefined,
    deliveryAddress: sl.deliveryAddress ?? undefined,
  };
}

/** Full record, including everything carried in the job-card document. */
function requirementsToUi(
  dto: FrpJobDTO,
  card?: FrpJobCardPayload | null
): JobProjectRequirement[] {
  const fromApi = new Map<ProjectRequirementKind, FrpJobProjectRequirementDTO>();
  for (const row of dto.requirements ?? []) {
    if (row.requirementName) {
      fromApi.set(row.requirementName, row);
    }
  }

  return PROJECT_REQUIREMENT_KINDS.map((kind) => {
    const row = fromApi.get(kind);
    const legacyValue =
      kind === "DOCUMENTS_REQUIRED"
        ? card?.documentsRequired
        : kind === "SAMPLE_REQUIRED"
          ? card?.sampleRequired
          : card?.coiRequired;
    const legacyRequired =
      typeof legacyValue === "boolean" ? legacyValue : null;

    return {
      kind,
      label: row?.label ?? PROJECT_REQUIREMENT_LABELS[kind],
      isRequired: row?.isRequired ?? legacyRequired,
      remarks: row?.remarks ?? null,
    };
  });
}

/** Materials list text from `job_measurements.materials` JSON. */
function materialsListFromMeasurements(
  measurements: FrpJobMeasurementDTO | null | undefined
): string | undefined {
  const raw = measurements?.materials?.materialsList;
  return typeof raw === "string" ? raw : undefined;
}

export function frpJobToUi(dto: FrpJobDTO): Job {
  const card = dto.jobCard ?? undefined;
  const spec = card?.productSpec;
  const payment = pickJobPayment(dto.payments);
  // The job card carries its own snapshot of contact details for print, but a
  // freshly created job has an empty card - fall back to the customer's first
  // contact (and then the company itself) so the job screen isn't blank until
  // someone fills in the card.

  const accountFromPayment =
    payment?.paymentMode === "ACCOUNT"
      ? true
      : payment?.paymentMode === "CASH"
        ? false
        : undefined;

  const printDetails: JobCardPrintDetails = {
    // Empty strings in jobCard must not block contactDetails / logistics fallbacks.
    purchaseOrderNo:
      card?.purchaseOrderNo || dto.orderNumber || undefined,
    contactPhone:
      card?.contactPhone || dto.contactDetails?.phone || undefined,
    contactEmail:
      card?.contactEmail || dto.contactDetails?.email || undefined,
    accountYesNo: card?.accountCustomer ?? accountFromPayment,
    raisedBy: card?.raisedBy || undefined,
    transport:
      card?.transport ||
      dto.schedulingLogistics?.shipmentMethod ||
      card?.shipmentMethod ||
      undefined,
    transportCompany: card?.transportCompany || undefined,
    freightAccount:
      card?.freightAccount ||
      dto.schedulingLogistics?.freightAccount ||
      undefined,
    consignmentNote: card?.consignmentNote || undefined,
    despatchDate:
      card?.despatchDate || dto.schedulingLogistics?.shipDate || undefined,
    deliveryDocket: card?.deliveryDocket || undefined,
    scopeType: spec?.constructionType || undefined,
    thickness: spec?.thicknessMm || undefined,
    mesh: spec?.meshSize || undefined,
    colour: spec?.colour || undefined,
    finish: spec?.finishType || undefined,
    clipRows: (card?.clipRows ?? []).map((r) => ({
      clip: r.clip ?? "",
      qty: r.qty ?? "",
      packedBy: r.packedBy ?? "",
    })),
    deliveryInstructions:
      card?.deliveryInstructions ||
      dto.schedulingLogistics?.deliveryAddress ||
      undefined,
    packs: packsFromPayload(card?.packs),
    scopeLines: card?.scopeLines ?? [],
    workflowExtras: {
      shipmentMethod: card?.shipmentMethod,
      billingAddress:
        card?.billingAddress ||
        dto.schedulingLogistics?.billingAddress ||
        undefined,
      deliveryAddress:
        card?.deliveryAddress ||
        dto.schedulingLogistics?.deliveryAddress ||
        undefined,
      materialRows: (card?.materialRows ?? []).map((m) => ({
        material: m.material ?? "",
        qty: m.qty ?? "",
        availability: m.availability ?? "",
      })),
      // Prefer dedicated job_measurements row; fall back to legacy jobCard fields.
      materialsList:
        materialsListFromMeasurements(dto.measurements) ?? card?.materialsList,
      programHistory: card?.programHistory ?? [],
      additionalNotes:
        dto.measurements?.notes ?? card?.additionalNotes,
      jobType: jobTypeToUi(dto.jobType) ?? undefined,
      paymentReceived:
        payment != null
          ? paymentReceivedFromStatus(payment.status)
          : card?.paymentReceived ?? null,
      paymentDueDate: payment?.dueDate ?? card?.paymentDueDate,
    },
  };

  return {
    dbId: dto.id != null ? String(dto.id) : undefined,
    id: dto.jobNumber ?? "",
    // The per-job details row is authoritative; the flat field is the
    // denormalised copy the list projection uses.
    clientName: dto.contactDetails?.companyName ?? dto.customerCompanyName ?? "",
    clientAddress: dto.contactDetails?.address || undefined,
    projectName: dto.projectName ?? "",
    date: card?.dateRaised ?? dto.createdDate?.slice(0, 10) ?? "",
    dueDate: dto.dueDate ?? null,
    quoteValidUntil: card?.quoteValidUntil ?? null,
    estimatedHours: dto.estimatedHours ?? null,
    // Resin lives on the job row, not the card — the card mirrors it for print.
    resinType: resinToUi(dto.resinCode),
    status: statusToUi(dto.stageStatus),
    priority: priorityToUi(dto.priority),
    alert: dto.alert ?? null,
    notes: dto.notes ?? null,
    description: dto.description ?? null,
    jobType: jobTypeToUi(dto.jobType),
    ownerName: dto.ownerName ?? null,
    orderNumber: dto.orderNumber ?? null,
    selectedItems: dto.selectedItems ?? null,
    // `currency` is the field; `payload.currency` is where this client used to
    // put it, and still where jobs created before the switch carry it. Reading
    // both means an existing job's currency survives the change.
    currency:
      dto.currency ??
      (typeof dto.payload?.currency === "string" ? dto.payload.currency : null),
    schedulingLogistics: schedulingLogisticsToUi(dto.schedulingLogistics),
    manufacturingRequired: card?.manufacturingRequired ?? true,
    installRequired: card?.installRequired ?? false,
    qaCompleted: card?.qaCompleted ?? false,
    clientContactName: dto.contactDetails?.contactName ?? "",
    assignedWorkerId: userIdToUi(dto.assignedUserId),
    assignedWorkerName: null,
    manualInstructions: card?.manualInstructions ?? "",
    printDetails,
    createdAt: dto.createdDate,
    quoteNumber: dto.quoteNumber ?? null,
  origin: dto.origin,
  currentStageKey: dto.currentStageKey ?? null,
  currentStageId: dto.currentStageId ?? null,
  inventory: (dto.inventory ?? []).map(inventoryLineToUi),
  requirements: requirementsToUi(dto, card),
  };
}

function inventoryLineToUi(line: FrpJobInventoryDTO): JobInventoryLine {
  const master = line.master;
  return {
    id: line.id,
    masterInventoryId: line.masterInventoryId ?? master?.id,
    category: master?.productGroup ?? null,
    profileType: master?.attribute1 ?? null,
    size: combineCatalogSize(master?.attribute2 ?? "", master?.attribute3 ?? ""),
    materialGrade: combineCatalogMaterialGrade(
      master?.material ?? "",
      master?.primaryColour ?? ""
    ),
    quantity: inventoryQuantityToUi(line.quantity),
  };
}

/** Integer quantity as stored by `JobInventoryDTO.quantity`; blanks become null. */
function inventoryQuantityToUi(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.trunc(value);
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
    // Folded into create because the job does not exist yet, so the dedicated
    // panel endpoints (which need a job id) cannot be called first.
    contactDetails: uiJobToContactDetails(job),
    projectName: job.projectName,
    dueDate: job.dueDate ?? undefined,
    priority: priorityToBackend(job.priority),
    // Write-only, create only. Backend defaults to PENDING when absent.
    stageStatusLabel: statusToBackend(job.status) ?? undefined,
    resinCode: resinToBackend(job.resinType),
    assignedUserId: userIdToBackend(job.assignedWorkerId) ?? undefined,
    estimatedHours: job.estimatedHours ?? undefined,
    alert: job.alert ?? undefined,
    notes: job.notes ?? undefined,
    description: job.description?.trim() || undefined,
    jobType: jobTypeToBackend(job.jobType) ?? undefined,
    schedulingLogistics: schedulingLogisticsToBackend(job.schedulingLogistics),
    selectedItems: job.selectedItems ?? undefined,
    // Its own field, not smuggled inside `payload`. `payload` is the raw body a
    // job was raised from; a currency picked in a dropdown is not that, and the
    // backend never read it from there — every manual job silently fell back to
    // AUD however the dropdown was set.
    currency: job.currency ?? undefined,
  };
}

/**
 * `PUT /jobs` — the id and the optimistic-lock token travel in the body.
 *
 * `stageStatus` is still omitted: it is `READ_ONLY` and derived from the stage
 * tree. `stageStatusLabel` is the writable channel — the backend applies it by
 * rewriting the stages, then recomputing the status from them, so the badge and
 * the tree cannot disagree. Sending the current status is a no-op server-side,
 * so it goes unconditionally rather than being diffed here.
 */
export function uiJobToUpdateRequest(job: Job): FrpJobDTO {
  if (job.dbId == null) {
    throw new Error(`Job ${job.id} has no database id — cannot update.`);
  }
  // contactDetails and schedulingLogistics are NOT sent here: on update they are
  // persisted through their own endpoints (PUT /jobs/{id}/contact-details and
  // /scheduling-logistics), chained after this call in JobsContext.updateJob,
  // the same way the job card is. This body is job-level fields only.
  return {
    id: Number(job.dbId),
    quoteNumber: job.quoteNumber ?? undefined,
    projectName: job.projectName,
    dueDate: job.dueDate ?? undefined,
    priority: priorityToBackend(job.priority),
    stageStatusLabel: statusToBackend(job.status) ?? undefined,
    resinCode: resinToBackend(job.resinType),
    assignedUserId: userIdToBackend(job.assignedWorkerId),
    estimatedHours: job.estimatedHours ?? undefined,
    alert: job.alert ?? undefined,
    notes: job.notes ?? undefined,
    description: job.description?.trim() || undefined,
    jobType: jobTypeToBackend(job.jobType) ?? undefined,
    // Line items are editable here, so the currency they are totalled in has to
    // be too. Omitting it leaves the payment's existing currency alone rather
    // than resetting it, so a partial update cannot silently change the money.
    selectedItems: job.selectedItems ?? undefined,
    currency: job.currency ?? undefined,
  };
}

/**
 * The job-card document for `PUT /jobs/{id}/job-card`.
 *
 * Fields the `Job` entity has no column for — `dateRaised`, `quoteValidUntil`,
 * the three workflow flags, `manualInstructions` — ride along here so they
 * round-trip. Rev 2 §07 lists `manufacturingRequired` / `installRequired` /
 * `qaCompleted` on the entity, but `JobDTO` does not expose them, so the API
 * cannot carry them today. Move them out of the card once the DTO does.
 *
 * Empty default clip catalogue rows are never persisted — only qty/packedBy
 * the operator actually filled. Materials live on `job_measurements`, not here.
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
    clipRows: clipRowsForCardPayload(pd?.clipRows),
    packs: [...packs],
    materialRows: extras?.materialRows,
    // materialsList / additionalNotes are owned by PUT /jobs/{id}/measurements.
    // notes are owned by job.notes (job update) — never dual-write into jobCard.
    shipmentMethod: extras?.shipmentMethod,
    billingAddress: extras?.billingAddress,
    deliveryAddress: extras?.deliveryAddress,
    programHistory: extras?.programHistory,
    dateRaised: job.date || undefined,
    quoteValidUntil: job.quoteValidUntil,
    manufacturingRequired: job.manufacturingRequired,
    installRequired: job.installRequired,
    qaCompleted: job.qaCompleted,
    manualInstructions: job.manualInstructions || undefined,
  };
}

/** Persist only clip rows the operator filled — not the blank STANDARD catalogue. */
function clipRowsForCardPayload(
  rows: { clip?: string; qty?: string; packedBy?: string }[] | undefined
): { clip?: string; qty?: string; packedBy?: string }[] | undefined {
  if (!rows?.length) return undefined;
  const filled = rows.filter(
    (r) => Boolean(r.qty?.trim()) || Boolean(r.packedBy?.trim())
  );
  if (filled.length === 0) return undefined;
  return filled.map((r) => ({
    clip: r.clip ?? "",
    qty: r.qty ?? "",
    packedBy: r.packedBy ?? "",
  }));
}
