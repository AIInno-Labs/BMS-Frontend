/**
 * Product catalog for the Job Inventory picker: the seed data, plus the
 * shape and cascading lookup logic shared by the org-admin catalog manager
 * (components/org/InventoryCatalogAdminPage.tsx) and the Job page's
 * Inventory modal (components/JobWorkflowDashboard.tsx).
 *
 * This is a frontend-only feature, not backed by any API - the `inventory`
 * table has no master item/SKU catalog (see V2__domain_reference_data.sql,
 * which deliberately left it out of scope). An org admin's edits are
 * persisted to this browser's localStorage only (see
 * inventory-catalog-store.ts) - they are not yet shared across devices or
 * other users in the org. Selecting an entry in the Job modal just fills in
 * the same free-text category/profileType/size/materialGrade strings the
 * backend already accepts, so nothing on the server needs to change. When a
 * real catalog endpoint exists, the store module can be swapped for one
 * backed by a fetch without touching the modal or admin page that consume
 * these helpers.
 *
 * The source sheet has 6 columns (Product Group, Desc. 1-3, Resin/Material,
 * Primary Colour) but the backend's `inventory` row only has 4 usable
 * free-text fields (category, profileType, size, materialGrade). So two
 * pairs get folded into one stored string each - Desc.2+Desc.3 into `size`,
 * and Resin+Colour into `materialGrade` - while still being shown as
 * separate dropdowns in the modal (see combine/split helpers below).
 */

export interface InventoryCatalogEntry {
  productGroup: string;
  profileType: string;
  meshSpec: string;
  dimension: string;
  resin: string;
  colour: string;
}

export const DEFAULT_INVENTORY_CATALOG: InventoryCatalogEntry[] = [
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1525 x 3050", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1525 x 3050", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1525 x 3660", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4000", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1220 x 3660", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "25mm thick", meshSpec: "38 square mesh", dimension: "1000 x 4083", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "40/20 square mesh", dimension: "1247 x 3687", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "40/20 square mesh", dimension: "1247 x 3687", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "40/20 square mesh", dimension: "1007 x 4007", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "40/20 square mesh", dimension: "1247 x 3687", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "40/20 square mesh", dimension: "1527 x 3800", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "40/12.5 square mesh", dimension: "1247 x 3687", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Grating - Moulded", profileType: "22mm thick", meshSpec: "40/12.5 square mesh", dimension: "1247 x 3687", resin: "IsoFR", colour: "Other" },
  { productGroup: "Grating - Moulded", profileType: "15mm thick", meshSpec: "38 square mesh", dimension: "3660 x 615", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "730 x 275", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "880 x 275", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "615 x 3050", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "730 x 275", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "880 x 275", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "730 x 275", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "920 x 275", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "Tread", meshSpec: "38 square mesh", dimension: "615 x 3050", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38+3mm thick", meshSpec: "38 square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38+3mm thick", meshSpec: "38 square mesh", dimension: "3660 x 1220", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "25+3mm thick", meshSpec: "38 square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "38+3mm thick", meshSpec: "38 square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Grating - Moulded", profileType: "38+3mm thick", meshSpec: "38 square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "2250 x 1000", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "38 square mesh", dimension: "3007 x 1000", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "15mm Thick", meshSpec: "50 Square mesh", dimension: "2440 x 1220", resin: "VEFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "15mm Thick", meshSpec: "50 Square mesh", dimension: "2440 x 1220", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "15mm Thick", meshSpec: "38 Square mesh", dimension: "2440 x 1220", resin: "VEFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "15mm Thick", meshSpec: "38 Square mesh", dimension: "2440 x 1220", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "50mm thick", meshSpec: "HLC", dimension: "3660 x 1220", resin: "VEFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "38mm thick", meshSpec: "HLC", dimension: "3660 x 1220", resin: "VEFR", colour: "Dark Grey" },
  { productGroup: "Grating - Moulded", profileType: "50mm", meshSpec: "50 Square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "50mm", meshSpec: "50 Square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "50mm", meshSpec: "38 Square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Yellow" },
  { productGroup: "Grating - Moulded", profileType: "50mm", meshSpec: "38 Square mesh", dimension: "3660 x 1220", resin: "IsoFR", colour: "Green" },
  { productGroup: "Grating - Moulded", profileType: "50mm", meshSpec: "Deck Board", dimension: "5000 x 875", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Nosings", profileType: "3mm", meshSpec: "", dimension: "70 x 30", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Nosings", profileType: "3mm", meshSpec: "", dimension: "70 x 30", resin: "VEFR", colour: "Dark Grey" },
  { productGroup: "Stanchions", profileType: "Square tube", meshSpec: "50 x 6", dimension: "1300", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Clips", profileType: "P Clamps", meshSpec: "48mm tube", dimension: "1.2 thk", resin: "316 s/s", colour: "Yellow" },
  { productGroup: "Stanchions", profileType: "3 hole base plates", meshSpec: "For 50mm SHS", dimension: "", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Stanchions", profileType: "90 degree elbows", meshSpec: "48mm", dimension: "", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "101 x 41", dimension: "6.3 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "101 x 41", dimension: "6.3 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "152 x 42", dimension: "6.3 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "152 x 42", dimension: "6.3 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "152 x 42", dimension: "9.5 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "152 x 42", dimension: "9.5 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "204 x 56", dimension: "9.5 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "204 x 56", dimension: "9.5 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "254 x 70", dimension: "12.7 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel", meshSpec: "254 x 70", dimension: "12.7 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Wide Flange Beam", meshSpec: "152", dimension: "6.3 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Wide Flange Beam", meshSpec: "152", dimension: "6.3 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "I Beam", meshSpec: "203 x 102", dimension: "9.5 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "I Beam", meshSpec: "203 x 102", dimension: "9.5 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "50", dimension: "6.3 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "50", dimension: "6.3 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "75", dimension: "9.5 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "75", dimension: "9.5 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "102", dimension: "9.5 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "102", dimension: "9.5 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "152", dimension: "12.7 thk", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Equal Angle", meshSpec: "152", dimension: "12.7 thk", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Strut", meshSpec: "25", dimension: "41", resin: "VEFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Strut", meshSpec: "41", dimension: "41", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Round Tube", meshSpec: "32 Fluted", dimension: "3.5", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Round Tube", meshSpec: "48", dimension: "5", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Round Tube", meshSpec: "38", dimension: "5", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Round Tube", meshSpec: "38", dimension: "5", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "32", dimension: "5", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "44", dimension: "3.15", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "44", dimension: "6", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "50.8", dimension: "3.15", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "50.8", dimension: "6", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "50.8", dimension: "6", resin: "IsoFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "50.8", dimension: "6", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "54", dimension: "5", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "75", dimension: "6", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "75", dimension: "6", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Square tube", meshSpec: "100", dimension: "8", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Rectagular tube", meshSpec: "100 x 50", dimension: "6", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Rectagular tube", meshSpec: "100 x 75", dimension: "6", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Kick plate", meshSpec: "100", dimension: "3", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Flat plate", meshSpec: "170", dimension: "13", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Flat plate", meshSpec: "170", dimension: "13", resin: "VEFR", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Flat Plate", meshSpec: "5", dimension: "1220 x 2440", resin: "VEFR", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Flat Plate", meshSpec: "4 Ungritted", dimension: "1220 x 3660", resin: "Iso", colour: "Yellow" },
  { productGroup: "Profiles", profileType: "Flat Plate", meshSpec: "4 Ungritted", dimension: "1220 x 3660", resin: "Iso", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Flat Plate", meshSpec: "4 Ungritted", dimension: "1220 x 3660", resin: "Iso", colour: "Light Grey" },
  { productGroup: "Profiles", profileType: "Flat Plate", meshSpec: "4 Ungritted", dimension: "1220 x 2440", resin: "Iso", colour: "Other" },
  { productGroup: "Profiles", profileType: "Rectangular tube (9m)", meshSpec: "250 x 100", dimension: "8", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "I Beam (9m)", meshSpec: "304 x 150", dimension: "13", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel (9m)", meshSpec: "86 x 75", dimension: "6", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel (9m)", meshSpec: "203 x 56", dimension: "9", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel (9m)", meshSpec: "145 x 35 3 degree", dimension: "6", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Profiles", profileType: "Channel (9m)", meshSpec: "152 x 42", dimension: "6", resin: "IsoFR", colour: "Dark Grey" },
  { productGroup: "Intrepid", profileType: "Intrepid gate UDG37", meshSpec: "", dimension: "", resin: "", colour: "" },
  { productGroup: "Fasteners", profileType: "Intrepid gate brackets", meshSpec: "", dimension: "", resin: "316SS", colour: "" },
  { productGroup: "Fasteners", profileType: "50mm U bolts", meshSpec: "", dimension: "", resin: "316SS", colour: "" },
  { productGroup: "Fasteners", profileType: "10mm J bolts", meshSpec: "", dimension: "", resin: "316SS", colour: "" },
  { productGroup: "Fasteners", profileType: "Kick plate joiner", meshSpec: "", dimension: "Straight", resin: "316SS", colour: "" },
  { productGroup: "Fasteners", profileType: "Kick plate joiner", meshSpec: "", dimension: "90 degree", resin: "316SS", colour: "" },
  { productGroup: "Clips", profileType: "MM40", meshSpec: "40 / 20 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "M50", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "M38", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "M25", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "M15", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "Square", meshSpec: "38mm", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "Square", meshSpec: "50mm", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "C50", meshSpec: "50 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "C38", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "C25", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "C15", meshSpec: "38 Sq mesh", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "Compression BTM", meshSpec: "", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "Pultruded", meshSpec: "", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "M38", meshSpec: "", dimension: "Boxed", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "M25", meshSpec: "", dimension: "Boxed", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "W Clip 45", meshSpec: "", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "W clip 54", meshSpec: "", dimension: "", resin: "316 s/s", colour: "" },
  { productGroup: "Clips", profileType: "W clip 30", meshSpec: "", dimension: "", resin: "316 s/s", colour: "" },
];

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim().length > 0))];
}

/** How a catalog row's mesh spec + dimension are combined into the
 *  backend's single `size` field. */
export function combineCatalogSize(meshSpec: string, dimension: string): string {
  return [meshSpec, dimension].filter(Boolean).join(" · ");
}

/** Inverse of combineCatalogSize, for re-deriving the Desc. 2 / Desc. 3
 *  selects' values from a stored `size` string. */
export function splitCatalogSize(value: string): {
  meshSpec: string;
  dimension: string;
} {
  const separator = " · ";
  const index = value.indexOf(separator);
  if (index === -1) return { meshSpec: value, dimension: "" };
  return {
    meshSpec: value.slice(0, index),
    dimension: value.slice(index + separator.length),
  };
}

/** How a catalog row's resin + colour are combined into the backend's
 *  single `materialGrade` field, since there is no dedicated colour
 *  column on the `inventory` table. */
export function combineCatalogMaterialGrade(resin: string, colour: string): string {
  return [resin, colour].filter(Boolean).join(" — ");
}

/** Inverse of combineCatalogMaterialGrade, for re-deriving the Resin and
 *  Colour selects' values from a stored `materialGrade` string. */
export function splitCatalogMaterialGrade(value: string): {
  resin: string;
  colour: string;
} {
  const separator = " — ";
  const index = value.indexOf(separator);
  if (index === -1) return { resin: value, colour: "" };
  return {
    resin: value.slice(0, index),
    colour: value.slice(index + separator.length),
  };
}

/**
 * The functions below all take `catalog` as their first argument rather
 * than reading DEFAULT_INVENTORY_CATALOG directly, so the same cascading
 * logic works for both the built-in seed list and an org's live,
 * admin-managed list from useInventoryCatalog() (see
 * inventory-catalog-store.ts).
 */

export function getCatalogProductGroups(catalog: InventoryCatalogEntry[]): string[] {
  return uniqueInOrder(catalog.map((r) => r.productGroup));
}

export function getCatalogProfileTypes(
  catalog: InventoryCatalogEntry[],
  productGroup: string
): string[] {
  return uniqueInOrder(
    catalog
      .filter((r) => r.productGroup === productGroup)
      .map((r) => r.profileType)
  );
}

export function getCatalogDesc2Options(
  catalog: InventoryCatalogEntry[],
  productGroup: string,
  profileType: string
): string[] {
  return uniqueInOrder(
    catalog
      .filter((r) => r.productGroup === productGroup && r.profileType === profileType)
      .map((r) => r.meshSpec)
  );
}

export function getCatalogDesc3Options(
  catalog: InventoryCatalogEntry[],
  productGroup: string,
  profileType: string,
  meshSpec: string
): string[] {
  return uniqueInOrder(
    catalog
      .filter(
        (r) =>
          r.productGroup === productGroup &&
          r.profileType === profileType &&
          r.meshSpec === meshSpec
      )
      .map((r) => r.dimension)
  );
}

export function getCatalogResinOptions(
  catalog: InventoryCatalogEntry[],
  productGroup: string,
  profileType: string,
  size: string
): string[] {
  return uniqueInOrder(
    catalog
      .filter(
        (r) =>
          r.productGroup === productGroup &&
          r.profileType === profileType &&
          combineCatalogSize(r.meshSpec, r.dimension) === size
      )
      .map((r) => r.resin)
  );
}

export function getCatalogColourOptions(
  catalog: InventoryCatalogEntry[],
  productGroup: string,
  profileType: string,
  size: string,
  resin: string
): string[] {
  return uniqueInOrder(
    catalog
      .filter(
        (r) =>
          r.productGroup === productGroup &&
          r.profileType === profileType &&
          combineCatalogSize(r.meshSpec, r.dimension) === size &&
          r.resin === resin
      )
      .map((r) => r.colour)
  );
}
