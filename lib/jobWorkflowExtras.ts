import type { Job, JobMaterialRow, JobWorkflowExtras } from "@/lib/types";
import { formatCreatedDate } from "@/lib/mockData";

export const JOB_TYPE_OPTIONS = [
  "Standard fabrication",
  "Custom structure",
  "Grating supply",
  "Handrail / ladder",
  "Repair / refit",
] as const;

export const PRODUCTION_STATUS_OPTIONS = [
  "Pending",
  "Drawing",
  "Awaiting approval",
  "Ready to manufacture",
  "In fabrication",
  "QA / invoicing",
  "Complete",
] as const;

export const SHIPMENT_METHOD_OPTIONS = [
  "FRP Engineering delivery",
  "Customer collect",
  "Third-party courier",
  "Freight forwarder",
  "To be confirmed",
] as const;

export const DEFAULT_MATERIAL_ROWS: JobMaterialRow[] = [
  { material: "Top Cap", qty: "", availability: "In stock" },
  { material: "Bottom Rail", qty: "", availability: "In stock" },
  { material: "Post", qty: "", availability: "Low stock" },
  { material: "Glass Stops", qty: "", availability: "In stock" },
  { material: "Clip assembly", qty: "", availability: "In stock" },
];

export function defaultProgramHistory(job: Job): string[] {
  const lines: string[] = [];
  if (job.createdAt) {
    lines.push(`Job created · ${formatCreatedDate(job.createdAt)}`);
  }
  if (job.quoteValidUntil) {
    lines.push(`Quote valid until · ${job.quoteValidUntil}`);
  }
  lines.push(`Workflow status set to ${job.status}`);
  return lines;
}

export function ensureWorkflowExtras(
  raw: Partial<JobWorkflowExtras> | undefined,
  job: Job
): JobWorkflowExtras {
  const materialRows =
    raw?.materialRows && raw.materialRows.length > 0
      ? raw.materialRows.map((r) => ({ ...r }))
      : DEFAULT_MATERIAL_ROWS.map((r) => ({ ...r }));

  const customFields =
    raw?.customFields && raw.customFields.length === 9
      ? [...raw.customFields]
      : Array.from({ length: 9 }, () => "");

  return {
    documentsRequired: raw?.documentsRequired ?? false,
    sampleRequired: raw?.sampleRequired ?? false,
    coiRequired: raw?.coiRequired ?? false,
    jobType: raw?.jobType ?? JOB_TYPE_OPTIONS[0],
    projectedStartDate: raw?.projectedStartDate ?? "",
    productionStatus: raw?.productionStatus ?? PRODUCTION_STATUS_OPTIONS[0],
    responsibleParty: raw?.responsibleParty ?? job.assignedWorkerName ?? "",
    accountable: raw?.accountable ?? "",
    shipmentMethod: raw?.shipmentMethod ?? "FRP Engineering delivery",
    carrierAccount: raw?.carrierAccount ?? "",
    billingAddress: raw?.billingAddress ?? "",
    deliveryAddress:
      raw?.deliveryAddress ?? job.printDetails?.deliveryInstructions ?? "",
    materialsList: raw?.materialsList ?? "",
    materialRows,
    customFields,
    programHistory:
      raw?.programHistory && raw.programHistory.length > 0
        ? [...raw.programHistory]
        : defaultProgramHistory(job),
    additionalNotes: raw?.additionalNotes ?? "",
    resinMatQty: raw?.resinMatQty ?? "48",
    fiberRollQty: raw?.fiberRollQty ?? "6",
    paymentReceived: raw?.paymentReceived ?? null,
    paymentDueDate: raw?.paymentDueDate ?? "",
    jobCardNotes: raw?.jobCardNotes ?? "",
  };
}

export function appendProgramHistory(
  extras: JobWorkflowExtras,
  line: string
): JobWorkflowExtras {
  const next = [line, ...(extras.programHistory ?? [])].slice(0, 12);
  return { ...extras, programHistory: next };
}
