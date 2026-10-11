import { ensurePrintDetails } from "@/lib/jobCardFormDefaults";
import type { Job, JobCardClipRow, JobCardPrintDetails, JobPriority, JobStatus } from "@/lib/types";
import { resolveWorkerIdFromName } from "@/lib/workers";
import {
  normalizeColour,
  normalizeFinishType,
  normalizeMeshSize,
  normalizeProductCategory,
  normalizeThicknessMm,
  resinDbToUi,
  resinUiToDb,
} from "@/lib/supabase/job-field-normalize";
import {
  parsePackDimensionsJson,
  serializePackDimensionsJson,
} from "@/lib/supabase/pack-dimensions-json";

export interface DbJobRow {
  id: string;
  quote_id: string | null;
  workflow_status: string;
  priority: string;
  date_raised: string;
  due_date: string | null;
  quote_valid_until?: string | null;
  raised_by: string;
  customer_name: string;
  project_name: string;
  transport_company: string | null;
  freight_account_number: string | null;
  consignment_note_number: string | null;
  despatch_date: string | null;
  delivery_docket_number: string | null;
  delivery_instructions: string | null;
  pack_dimensions: string | null;
  construction_type: string | null;
  product_category: string | null;
  mesh_size: string | null;
  thickness_mm: string | null;
  resin_type: string | null;
  finish_type: string | null;
  colour: string | null;
  nosing_colour: string | null;
  estimated_hours: number | null;
  alert_message: string | null;
  assigned_worker_name?: string | null;
  manual_instructions?: string | null;
  client_contact_name?: string | null;
  manufacturing_required?: boolean | null;
  install_required?: boolean | null;
  qa_completed?: boolean | null;
  created_at: string;
}

function normalizeStatus(status: string): JobStatus {
  const allowed: JobStatus[] = [
    "Pending",
    "Awaiting Manager Approval",
    "Ready to Manufacture",
    "In Fabrication",
    "On Hold",
    "Complete",
    "Cancelled",
  ];
  if (allowed.includes(status as JobStatus)) return status as JobStatus;
  return "Pending";
}

export function dbRowToJob(row: DbJobRow): Job {
  const parsed = parsePackDimensionsJson(row.pack_dimensions);
  const printDetails: JobCardPrintDetails = {
    raisedBy: row.raised_by,
    purchaseOrderNo: parsed.purchaseOrderNo ?? "",
    contactPhone: parsed.contactPhone ?? "",
    contactEmail: parsed.contactEmail ?? "",
    transport: parsed.transport ?? "FRP Engineering",
    transportCompany: row.transport_company ?? "",
    freightAccount: row.freight_account_number ?? "",
    consignmentNote: row.consignment_note_number ?? "",
    despatchDate: row.despatch_date ?? "",
    deliveryDocket: row.delivery_docket_number ?? "",
    deliveryInstructions: row.delivery_instructions ?? "",
    scopeType: row.product_category ?? "",
    thickness: row.thickness_mm ?? "",
    mesh: row.mesh_size ?? "",
    colour: row.colour ?? "",
    finish: row.finish_type ?? "",
    scopeLines: parsed.scopeLines?.length ? parsed.scopeLines : [row.project_name],
    clipRows: parsed.clipRows ?? ([] as JobCardClipRow[]),
    packs: parsed.packs,
    workflowExtras: parsed.workflowExtras,
  };

  const baseJob: Job = {
    id: row.id,
    clientName: row.customer_name,
    projectName: row.project_name,
    date: row.date_raised,
    dueDate: row.due_date ?? null,
    quoteValidUntil: row.quote_valid_until ?? null,
    estimatedHours: row.estimated_hours,
    resinType: resinDbToUi(row.resin_type),
    status: normalizeStatus(row.workflow_status),
    priority: row.priority as JobPriority,
    alert: row.alert_message,
    manufacturingRequired: row.manufacturing_required ?? true,
    installRequired: row.install_required ?? false,
    qaCompleted: row.qa_completed ?? false,
    clientContactName: row.client_contact_name ?? "",
    assignedWorkerId: resolveWorkerIdFromName(row.assigned_worker_name ?? null),
    assignedWorkerName: row.assigned_worker_name ?? null,
    manualInstructions: row.manual_instructions ?? "",
    printDetails,
    createdAt: row.created_at,
  };

  return {
    ...baseJob,
    printDetails: ensurePrintDetails(baseJob),
  };
}

/** Maps UI job → DB update. Omits locked identity fields (id, customer, project). */
export function jobToDbUpdate(job: Job): Record<string, unknown> {
  const p = job.printDetails ?? {};
  return {
    workflow_status: job.status,
    priority: job.priority,
    date_raised: job.date,
    due_date: job.dueDate?.trim() ? job.dueDate.trim() : null,
    raised_by: p.raisedBy || job.printDetails?.raisedBy || "—",
    transport_company: p.transportCompany || null,
    freight_account_number: p.freightAccount || null,
    consignment_note_number: p.consignmentNote || null,
    despatch_date: p.despatchDate || null,
    delivery_docket_number: p.deliveryDocket || null,
    delivery_instructions: p.deliveryInstructions || null,
    pack_dimensions: serializePackDimensionsJson(p),
    product_category: normalizeProductCategory(p.scopeType),
    thickness_mm: normalizeThicknessMm(p.thickness),
    mesh_size: normalizeMeshSize(p.mesh),
    colour: normalizeColour(p.colour),
    finish_type: normalizeFinishType(p.finish),
    resin_type: resinUiToDb(job.resinType),
    estimated_hours: job.estimatedHours,
    alert_message: job.alert?.trim() ? job.alert.trim() : null,
    assigned_worker_name: job.assignedWorkerName ?? null,
    manual_instructions: job.manualInstructions || null,
    client_contact_name: job.clientContactName || null,
    manufacturing_required: job.manufacturingRequired,
    install_required: job.installRequired,
    qa_completed: job.qaCompleted,
  };
}

