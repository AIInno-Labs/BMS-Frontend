import type { OfficialJobCardData, JobCardClipRow, JobCardPack } from "@/lib/jobCardPrint";

/** Spring `JobCardExportDTO` from `GET /jobs/{id}/job-card`. */
export interface JobCardExportDTO {
  jobNumber?: string;
  date?: string;
  dueDate?: string;
  validUntil?: string;
  raisedBy?: string;
  customer?: string;
  customerAddress?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  purchaseOrderNo?: string;
  accountYesNo?: string;
  transport?: string;
  transportCompany?: string;
  freightAccount?: string;
  consignmentNote?: string;
  despatchDate?: string;
  deliveryDocket?: string;
  scopeLines?: string[];
  scopeType?: string;
  thickness?: string;
  mesh?: string;
  resin?: string;
  colour?: string;
  finish?: string;
  clipRows?: { clip?: string; qty?: string; packedBy?: string }[];
  notes?: string;
  deliveryInstructions?: string;
  packs?: { length?: string; width?: string; height?: string; weightKg?: string }[];
  manufacturingRequired?: boolean;
  installRequired?: boolean;
  qaCompleted?: boolean;
  status?: string;
  priority?: string;
  assignedWorker?: string;
  estimatedHours?: string;
  jobCardVersion?: number;
}

const EMPTY_PACK: JobCardPack = {
  length: "",
  width: "",
  height: "",
  weightKg: "",
};

function packAt(
  packs: JobCardExportDTO["packs"],
  index: number
): JobCardPack {
  const p = packs?.[index];
  return {
    length: p?.length ?? "",
    width: p?.width ?? "",
    height: p?.height ?? "",
    weightKg: p?.weightKg ?? "",
  };
}

/** Map backend export DTO → print HTML field object. */
export function jobCardExportToOfficial(
  dto: JobCardExportDTO
): OfficialJobCardData {
  const clipRows: JobCardClipRow[] = (dto.clipRows ?? []).map((r) => ({
    clip: r.clip ?? "",
    qty: r.qty ?? "",
    packedBy: r.packedBy ?? "",
  }));

  return {
    jobNumber: dto.jobNumber ?? "",
    date: dto.date ?? "—",
    dueDate: dto.dueDate ?? "—",
    validUntil: dto.validUntil ?? "—",
    raisedBy: dto.raisedBy ?? "",
    customer: dto.customer ?? "",
    customerAddress: dto.customerAddress ?? "",
    contactName: dto.contactName ?? "",
    contactPhone: dto.contactPhone ?? "",
    contactEmail: dto.contactEmail ?? "",
    purchaseOrderNo: dto.purchaseOrderNo ?? "",
    accountYesNo: dto.accountYesNo ?? "Yes",
    transport: dto.transport ?? "FRP Engineering",
    transportCompany: dto.transportCompany ?? "",
    freightAccount: dto.freightAccount ?? "",
    consignmentNote: dto.consignmentNote ?? "",
    despatchDate: dto.despatchDate ?? "",
    deliveryDocket: dto.deliveryDocket ?? "",
    scopeLines: dto.scopeLines ?? [],
    scopeType: dto.scopeType ?? "",
    thickness: dto.thickness ?? "",
    mesh: dto.mesh ?? "",
    resin: dto.resin ?? "",
    colour: dto.colour ?? "",
    finish: dto.finish ?? "",
    clipRows,
    notes: dto.notes ?? "",
    deliveryInstructions: dto.deliveryInstructions ?? "",
    packs: [
      packAt(dto.packs, 0) || EMPTY_PACK,
      packAt(dto.packs, 1) || EMPTY_PACK,
      packAt(dto.packs, 2) || EMPTY_PACK,
    ],
    manufacturingRequired: dto.manufacturingRequired ?? false,
    installRequired: dto.installRequired ?? false,
    qaCompleted: dto.qaCompleted ?? false,
    status: dto.status ?? "",
    priority: dto.priority ?? "",
    assignedWorker: dto.assignedWorker ?? "",
    estimatedHours: dto.estimatedHours ?? "",
    jobCardVersion: dto.jobCardVersion ?? 0,
  };
}
