import type { ResinType } from "@/lib/types";

/** Allowed `jobs.product_category` values (Postgres check). */
export const DB_PRODUCT_CATEGORIES = ["Grating", "Tread", "Other"] as const;

export const DB_THICKNESS_MM = [
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

export const DB_MESH_SIZES = [
  "38x38",
  "50x50",
  "38/19 sq",
  "40/20 sq",
  "38x12.5 sq",
  "40x13 sq",
  "Other",
] as const;

export const DB_COLOURS = [
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

export const DB_FINISH_TYPES = [
  "Grit #1",
  "Grit #2",
  "Grit #3",
  "Grit #4",
  "Grit #5",
  "Grit #6",
  "Grit #7",
  "Grit #8",
  "Grit #9",
  "Sand",
  "Other",
] as const;

export const DB_RESIN_CODES = ["O", "OFR", "I", "IFR", "VE", "VEFR", "Phen", "Other"] as const;

const UI_FINISH_TO_DB: Record<string, (typeof DB_FINISH_TYPES)[number]> = {
  Natural: "Sand",
  "Grit top": "Grit #1",
  Painted: "Other",
  Other: "Other",
};

const UI_SCOPE_TO_CATEGORY: Record<string, (typeof DB_PRODUCT_CATEGORIES)[number]> = {
  Grating: "Grating",
  Tread: "Tread",
  Ladder: "Other",
  Handrail: "Other",
  Walkway: "Other",
  Structure: "Other",
  "Trench / Enclosure": "Other",
  Profiles: "Other",
  Other: "Other",
};

function blankToNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : null;
}

export function normalizeProductCategory(scopeType: string | null | undefined): string | null {
  const raw = blankToNull(scopeType);
  if (!raw) return null;
  if ((DB_PRODUCT_CATEGORIES as readonly string[]).includes(raw)) return raw;
  return UI_SCOPE_TO_CATEGORY[raw] ?? "Other";
}

export function normalizeThicknessMm(thickness: string | null | undefined): string | null {
  const raw = blankToNull(thickness);
  if (!raw) return null;
  const digits = raw.replace(/\s*mm\s*/gi, "").trim();
  if ((DB_THICKNESS_MM as readonly string[]).includes(digits)) return digits;
  const match = digits.match(/\b(15|20|22|25|30|32|38|40|50)\b/);
  if (match) return match[1];
  return "Other";
}

export function normalizeMeshSize(mesh: string | null | undefined): string | null {
  const raw = blankToNull(mesh);
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  const hit = DB_MESH_SIZES.find(
    (m) => m.replace(/\s+/g, "").toLowerCase() === compact
  );
  if (hit) return hit;
  if (/38\s*[x×]\s*38/i.test(raw)) return "38x38";
  if (/50\s*[x×]\s*50/i.test(raw)) return "50x50";
  return "Other";
}

export function normalizeColour(colour: string | null | undefined): string | null {
  const raw = blankToNull(colour);
  if (!raw) return null;
  const title = raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const hit = DB_COLOURS.find((c) => c.toLowerCase() === title.toLowerCase());
  return hit ?? "Other";
}

export function normalizeFinishType(finish: string | null | undefined): string | null {
  const raw = blankToNull(finish);
  if (!raw) return null;
  if ((DB_FINISH_TYPES as readonly string[]).includes(raw)) return raw;
  return UI_FINISH_TO_DB[raw] ?? "Other";
}

export function resinUiToDb(resin: ResinType | string | null | undefined): string | null {
  const r = (resin ?? "").toLowerCase();
  if (!r) return null;
  if (r.includes("vinyl") || r.includes("vefr") || r === "ve") return "VEFR";
  if (r.includes("phen")) return "Phen";
  if (r.includes("isophthalic") || r.includes("polyester") || r === "i") return "I";
  if (r.includes("ifr")) return "IFR";
  if (r.includes("ofr")) return "OFR";
  return "Other";
}

export function resinDbToUi(resin: string | null): ResinType {
  const r = (resin ?? "").toUpperCase();
  if (r.includes("VE") || r === "VEFR") return "Vinyl Ester";
  if (r.includes("PHEN")) return "Phenolic";
  return "Isophthalic Polyester";
}
