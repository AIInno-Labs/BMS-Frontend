import type {
  JobCardClipRow,
  JobCardPack,
  JobCardPrintDetails,
  JobWorkflowExtras,
} from "@/lib/types";

const EMPTY_PACK: JobCardPack = {
  length: "",
  width: "",
  height: "",
  weightKg: "",
};

export type ParsedPackDimensions = {
  packs: [JobCardPack, JobCardPack, JobCardPack];
  clipRows?: JobCardClipRow[];
  scopeLines?: string[];
  purchaseOrderNo?: string;
  contactPhone?: string;
  contactEmail?: string;
  transport?: string;
  accountYesNo?: boolean;
  workflowExtras?: JobWorkflowExtras;
};

type PackDimensionsPayloadV2 = {
  v: 2;
  packs: JobCardPack[];
  clipRows?: JobCardClipRow[];
  scopeLines?: string[];
  purchaseOrderNo?: string;
  contactPhone?: string;
  contactEmail?: string;
  transport?: string;
  accountYesNo?: boolean;
  workflowExtras?: JobWorkflowExtras;
};

function emptyPacks(): [JobCardPack, JobCardPack, JobCardPack] {
  return [
    { ...EMPTY_PACK },
    { ...EMPTY_PACK },
    { ...EMPTY_PACK },
  ];
}

function normalizePacks(arr: JobCardPack[] | undefined): [JobCardPack, JobCardPack, JobCardPack] {
  return [
    { ...EMPTY_PACK, ...(arr?.[0] ?? {}) },
    { ...EMPTY_PACK, ...(arr?.[1] ?? {}) },
    { ...EMPTY_PACK, ...(arr?.[2] ?? {}) },
  ];
}

function hasWorkflowExtras(extras: JobWorkflowExtras | undefined): boolean {
  if (!extras) return false;
  return Boolean(
    extras.documentsRequired ||
      extras.sampleRequired ||
      extras.coiRequired ||
      extras.jobType?.trim() ||
      extras.projectedStartDate?.trim() ||
      extras.productionStatus?.trim() ||
      extras.responsibleParty?.trim() ||
      extras.accountable?.trim() ||
      extras.shipmentMethod?.trim() ||
      extras.carrierAccount?.trim() ||
      extras.billingAddress?.trim() ||
      extras.deliveryAddress?.trim() ||
      extras.materialsList?.trim() ||
      extras.additionalNotes?.trim() ||
      (extras.materialRows && extras.materialRows.some((r) => r.qty?.trim())) ||
      (extras.customFields && extras.customFields.some((f) => f.trim())) ||
      (extras.programHistory && extras.programHistory.length > 0)
  );
}

function hasPrintExtras(p: JobCardPrintDetails): boolean {
  return Boolean(
    (p.clipRows && p.clipRows.some((r) => r.qty?.trim() || r.packedBy?.trim())) ||
      (p.scopeLines && p.scopeLines.length > 1) ||
      p.purchaseOrderNo?.trim() ||
      p.contactPhone?.trim() ||
      p.contactEmail?.trim() ||
      (p.transport && p.transport !== "FRP Engineering") ||
      p.accountYesNo === false ||
      hasWorkflowExtras(p.workflowExtras)
  );
}

/** Parses legacy pack array or v2 object from `jobs.pack_dimensions`. */
export function parsePackDimensionsJson(
  raw: string | null | undefined
): ParsedPackDimensions {
  if (!raw?.trim()) {
    return { packs: emptyPacks() };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { packs: normalizePacks(parsed as JobCardPack[]) };
    }
    if (parsed && typeof parsed === "object" && (parsed as PackDimensionsPayloadV2).v === 2) {
      const o = parsed as PackDimensionsPayloadV2;
      return {
        packs: normalizePacks(o.packs),
        clipRows: o.clipRows,
        scopeLines: o.scopeLines,
        purchaseOrderNo: o.purchaseOrderNo,
        contactPhone: o.contactPhone,
        contactEmail: o.contactEmail,
        transport: o.transport,
        accountYesNo: o.accountYesNo,
        workflowExtras: o.workflowExtras,
      };
    }
  } catch {
    /* fall through */
  }
  return { packs: emptyPacks() };
}

/** Serializes packs + PDF-only fields into `jobs.pack_dimensions` (backward compatible). */
export function serializePackDimensionsJson(
  printDetails: JobCardPrintDetails | undefined
): string | null {
  const p = printDetails ?? {};
  const packs = p.packs ?? emptyPacks();
  const hasPacks = packs.some(
    (pk) => pk.length?.trim() || pk.width?.trim() || pk.height?.trim() || pk.weightKg?.trim()
  );

  if (!hasPacks && !hasPrintExtras(p)) {
    return null;
  }

  if (!hasPrintExtras(p)) {
    return JSON.stringify(packs);
  }

  const payload: PackDimensionsPayloadV2 = {
    v: 2,
    packs: [...packs],
    clipRows: p.clipRows,
    scopeLines: p.scopeLines,
    purchaseOrderNo: p.purchaseOrderNo || undefined,
    contactPhone: p.contactPhone || undefined,
    contactEmail: p.contactEmail || undefined,
    transport: p.transport || undefined,
    accountYesNo: p.accountYesNo,
    workflowExtras: p.workflowExtras,
  };
  return JSON.stringify(payload);
}
