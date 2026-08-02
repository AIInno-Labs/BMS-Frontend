/**
 * Regex keyword extraction — maps unstructured Quotient text into
 * rigid Job Card dropdown values (shop floor specification sheet).
 */

export interface ParsedShopFloorSpecs {
  construction_type: string | null;
  product_category: string | null;
  mesh_size: string | null;
  thickness_mm: string | null;
  resin_type: string | null;
  finish_type: string | null;
  colour: string | null;
  nosing_colour: string | null;
}

const RESIN_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /\bVEFR\b/i, value: "VEFR" },
  { pattern: /\bVE\s*FR\b/i, value: "VEFR" },
  { pattern: /\bvinyl\s*ester\b/i, value: "VE" },
  { pattern: /\bIFR\b/i, value: "IFR" },
  { pattern: /\bisophthalic\b/i, value: "I" },
  { pattern: /\bIsoFR\b/i, value: "OFR" },
  { pattern: /\bIso\s*FR\b/i, value: "OFR" },
  { pattern: /\bphenolic\b/i, value: "Phen" },
  { pattern: /\bPhen\b/i, value: "Phen" },
];

const MESH_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /\b38\s*[x\/]\s*38\b/i, value: "38x38" },
  { pattern: /\b50\s*[x\/]\s*50\b/i, value: "50x50" },
  { pattern: /\b38\s*\/\s*19\s*sq\b/i, value: "38/19 sq" },
  { pattern: /\b40\s*\/\s*20\s*sq\b/i, value: "40/20 sq" },
  { pattern: /\b38\s*\/\s*12\.?5\s*sq\b/i, value: "38x12.5 sq" },
  { pattern: /\b40\s*\/\s*13\s*sq\b/i, value: "40x13 sq" },
];

const THICKNESS_PATTERN =
  /\b(15|20|22|25|30|32|38|40|50)\s*mm\b|\b(15|20|22|25|30|32|38|40|50)\s*thick/i;

const COLOUR_PATTERNS: { pattern: RegExp; value: string }[] = [
  { pattern: /\bcharcoal\b/i, value: "Charcoal" },
  { pattern: /\bsafety\s*yellow\b|\byellow\s*grating\b/i, value: "Yellow" },
  { pattern: /\bgreen\b/i, value: "Green" },
  { pattern: /\bconcrete\s*grey\b|\bconcrete\b/i, value: "Concrete" },
  { pattern: /\bblue\b/i, value: "Blue" },
  { pattern: /\bred\b/i, value: "Red" },
  { pattern: /\blight\s*grey\b/i, value: "Light Grey" },
  { pattern: /\bdark\s*grey\b|\bgrey\b/i, value: "Dark Grey" },
  { pattern: /\btransparent\b/i, value: "Transparent" },
];

const GRIT_PATTERN = /\bgrit\s*#?\s*([1-9])\b/i;

export function extractSearchableText(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) parts.push(v);
  };

  push(payload.title);
  push(payload.item_headings);
  push(payload.for);

  const items = payload.selected_items;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        push(o.heading);
        push(o.description);
        push(o.item_code);
      }
    }
  }

  return parts.join("\n");
}

export function parseShopFloorSpecs(text: string): ParsedShopFloorSpecs {
  const t = text.toLowerCase();

  let construction_type: string | null = null;
  if (/\bpultrud/i.test(text)) construction_type = "Pultruded";
  else if (/\bmoulded|\bmolded/i.test(text)) construction_type = "Moulded";

  let product_category: string | null = null;
  if (/\bgrating|\bgrate\b/i.test(text)) product_category = "Grating";
  else if (/\btread|\bstair/i.test(text)) product_category = "Tread";

  let mesh_size: string | null = null;
  for (const { pattern, value } of MESH_PATTERNS) {
    if (pattern.test(text)) {
      mesh_size = value;
      break;
    }
  }

  let thickness_mm: string | null = null;
  const thickHit = text.match(THICKNESS_PATTERN);
  if (thickHit) {
    thickness_mm = thickHit[1] ?? thickHit[2] ?? null;
  }

  let resin_type: string | null = null;
  for (const { pattern, value } of RESIN_PATTERNS) {
    if (pattern.test(text)) {
      resin_type = value;
      break;
    }
  }

  let finish_type: string | null = null;
  const gritHit = text.match(GRIT_PATTERN);
  if (gritHit) finish_type = `Grit #${gritHit[1]}`;
  else if (/\bsand\s*finish|\bsanded\b/i.test(text)) finish_type = "Sand";

  let colour: string | null = null;
  for (const { pattern, value } of COLOUR_PATTERNS) {
    if (pattern.test(text)) {
      colour = value;
      break;
    }
  }

  let nosing_colour: string | null = null;
  if (/\byellow\s*nosing|\bnosing\s*yellow|\bgrit\s*nosing/i.test(text)) {
    nosing_colour = "Yellow";
  } else if (/\bblack\s*nosing|\bnosing\s*black/i.test(text)) {
    nosing_colour = "Black";
  }

  return {
    construction_type,
    product_category,
    mesh_size,
    thickness_mm,
    resin_type,
    colour,
    finish_type,
    nosing_colour,
  };
}
