import {
  STANDARD_CLIP_ROWS,
  type JobCardPrintDetails,
} from "@/lib/jobCardPrint";
import { ensureWorkflowExtras } from "@/lib/jobWorkflowExtras";
import type { Job, JobCardClipRow, JobCardPack } from "@/lib/types";

const EMPTY_PACK: JobCardPack = {
  length: "",
  width: "",
  height: "",
  weightKg: "",
};

export const TRANSPORT_OPTIONS = [
  "FRP Engineering",
  "Customer collect",
  "Third-party courier",
  "To be confirmed",
] as const;

export const SCOPE_TYPE_OPTIONS = [
  "",
  "Ladder",
  "Grating",
  "Handrail",
  "Walkway",
  "Structure",
  "Trench / Enclosure",
  "Profiles",
  "Other",
] as const;

export const FINISH_OPTIONS = [
  "",
  "Grit #1",
  "Grit #2",
  "Grit #3",
  "Sand",
  "Other",
] as const;

export const THICKNESS_OPTIONS = [
  "",
  "15",
  "20",
  "22",
  "25",
  "30",
  "32",
  "38",
  "40",
  "50",
  "Other",
] as const;

export const MESH_OPTIONS = [
  "",
  "38x38",
  "50x50",
  "38/19 sq",
  "40/20 sq",
  "38x12.5 sq",
  "40x13 sq",
  "Other",
] as const;

export const COLOUR_OPTIONS = [
  "",
  "Green",
  "Yellow",
  "Concrete",
  "Charcoal",
  "Blue",
  "Transparent",
  "Red",
  "Light Grey",
  "Dark Grey",
  "Other",
] as const;

/** Ensures every official PDF field has a value object (empty string = blank on form/PDF). */
export function ensurePrintDetails(job: Job): JobCardPrintDetails {
  const p = job.printDetails ?? {};

  const clipRows =
    p.clipRows && p.clipRows.some((r) => r.qty?.trim() || r.packedBy?.trim())
      ? STANDARD_CLIP_ROWS.map((row) => {
          const hit = p.clipRows!.find(
            (r) => r.clip.toLowerCase() === row.clip.toLowerCase()
          );
          return hit
            ? { ...row, qty: hit.qty ?? "", packedBy: hit.packedBy ?? "" }
            : { ...row };
        })
      : STANDARD_CLIP_ROWS.map((r) => ({ ...r }));

  const packs: [JobCardPack, JobCardPack, JobCardPack] = [
    { ...EMPTY_PACK, ...(p.packs?.[0] ?? {}) },
    { ...EMPTY_PACK, ...(p.packs?.[1] ?? {}) },
    { ...EMPTY_PACK, ...(p.packs?.[2] ?? {}) },
  ];

  // Materials list (job_measurements) is the scope text when present.
  const materialsList = p.workflowExtras?.materialsList?.trim();
  const scopeFromMaterials = materialsList
    ? materialsList.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    purchaseOrderNo: p.purchaseOrderNo ?? "",
    contactPhone: p.contactPhone ?? "",
    contactEmail: p.contactEmail ?? "",
    accountYesNo: p.accountYesNo ?? true,
    raisedBy: p.raisedBy ?? "",
    transport: p.transport ?? "FRP Engineering",
    transportCompany: p.transportCompany ?? "",
    freightAccount: p.freightAccount ?? "",
    consignmentNote: p.consignmentNote ?? "",
    despatchDate: p.despatchDate ?? "",
    deliveryDocket: p.deliveryDocket ?? "",
    scopeType: p.scopeType ?? "",
    thickness: p.thickness ?? "",
    mesh: p.mesh ?? "",
    colour: p.colour ?? "",
    finish: p.finish ?? "",
    // Empty when the job has no scope recorded - not [job.projectName].
    // The project name is what the job is called, not what it is made of, and
    // rendering it under "List of materials" states a material that was never
    // entered. It also made the panel's own "No materials list." unreachable,
    // since a one-element array is always truthy.
    scopeLines:
      scopeFromMaterials.length > 0
        ? scopeFromMaterials
        : p.scopeLines && p.scopeLines.length > 0
          ? [...p.scopeLines]
          : [],
    clipRows,
    deliveryInstructions: p.deliveryInstructions ?? "",
    packs,
    workflowExtras: ensureWorkflowExtras(p.workflowExtras, job),
  };
}

export function findSimilarJobs(
  allJobs: Job[],
  current: Job,
  limit = 6
): Job[] {
  return allJobs
    .filter((j) => j.id !== current.id)
    .map((j) => {
      let score = 0;
      if (j.clientName === current.clientName) score += 3;
      if (j.resinType === current.resinType) score += 1;
      if (j.status === current.status) score += 1;
      return { job: j, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.job);
}

export function clonePrintDetailsFromJob(source: Job): JobCardPrintDetails {
  const src = ensurePrintDetails(source);
  return {
    ...src,
    scopeLines: src.scopeLines ? [...src.scopeLines] : undefined,
    clipRows: src.clipRows?.map((r) => ({ ...r })),
    packs: src.packs
      ? [
          { ...src.packs[0] },
          { ...src.packs[1] },
          { ...src.packs[2] },
        ]
      : undefined,
  };
}

export function scopeLinesToText(lines: string[] | undefined): string {
  return (lines ?? []).join("\n");
}

export function textToScopeLines(text: string): string[] {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function updateClipRow(
  rows: JobCardClipRow[],
  index: number,
  patch: Partial<JobCardClipRow>
): JobCardClipRow[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}
