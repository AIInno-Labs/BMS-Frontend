import type {
  Job,
  JobMaterialRow,
  JobWorkflowExtras,
  ShipmentMethod,
} from "@/lib/types";
import { JOB_TYPE_LABELS } from "@/lib/frp/job-status";
import { formatCreatedDate } from "@/lib/mockData";

export const JOB_TYPE_OPTIONS = JOB_TYPE_LABELS;

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

/**
 * The labels above are what an operator reads; `job_scheduling_logistics`
 * stores the enum. Kept as one map in both directions so the two vocabularies
 * cannot drift apart in separate translations.
 */
const SHIPMENT_METHOD_TO_BACKEND: Record<string, ShipmentMethod> = {
  "FRP Engineering delivery": "INHOUSE_DELIVERY",
  "Customer collect": "CUSTOMER_COLLECT",
  "Third-party courier": "THIRD_PARTY_COURIER",
  "Freight forwarder": "FREIGHT_FORWARDER",
  "To be confirmed": "OTHER",
};

const SHIPMENT_METHOD_TO_LABEL = Object.fromEntries(
  Object.entries(SHIPMENT_METHOD_TO_BACKEND).map(([label, code]) => [code, label])
) as Record<ShipmentMethod, string>;

/** Label → enum. Null when unset or unrecognised, so nothing is guessed. */
export function shipmentMethodToBackend(
  label: string | null | undefined
): ShipmentMethod | null {
  if (!label) return null;
  return SHIPMENT_METHOD_TO_BACKEND[label.trim()] ?? null;
}

/** Enum → label. Falls back to the raw value rather than showing nothing. */
export function shipmentMethodToLabel(
  code: ShipmentMethod | string | null | undefined
): string {
  if (!code) return "";
  return SHIPMENT_METHOD_TO_LABEL[code as ShipmentMethod] ?? String(code);
}

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
    jobType: raw?.jobType ?? job.jobType ?? undefined,
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
