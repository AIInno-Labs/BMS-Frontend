/**
 * Cascading lookup helpers for the Job Inventory picker and the org-admin
 * catalog page. Both screens load the live list from `GET /master-inventory`
 * (`useInventoryCatalog`). The catalogue rows themselves are hardcoded in
 * `frp/docs/seed.sql`.
 *
 * Sheet columns map onto `MasterInventoryDTO` as:
 *   Product Group → productGroup
 *   Attribute 1   → attribute1 (profileType)
 *   Attribute 2   → attribute2 (meshSpec)
 *   Attribute 3   → attribute3 (dimension)
 *   Resin         → material
 *   Colour        → primaryColour
 *   attribute4 is stored in the DB but omitted from the API and UI for now.
 *
 * The job modal folds Attribute 2+3 into a single `size` string and
 * Resin+Colour into `materialGrade` so the cascading selects can round-trip.
 */

export interface InventoryCatalogEntry {
  productGroup: string;
  profileType: string;
  meshSpec: string;
  dimension: string;
  resin: string;
  colour: string;
}

export interface InventoryCatalogItem extends InventoryCatalogEntry {
  id: number;
}

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
 * Cascading dropdown options. `catalog` is the live list from
 * `useInventoryCatalog()` (GET /master-inventory), not a frontend seed file.
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

export interface MasterInventoryFields {
  id?: number;
  productGroup?: string | null;
  attribute1?: string | null;
  attribute2?: string | null;
  attribute3?: string | null;
  material?: string | null;
  primaryColour?: string | null;
}

export function masterInventoryToCatalogItem(
  item: MasterInventoryFields
): InventoryCatalogItem {
  return {
    id: item.id ?? 0,
    productGroup: item.productGroup ?? "",
    profileType: item.attribute1 ?? "",
    meshSpec: item.attribute2 ?? "",
    dimension: item.attribute3 ?? "",
    resin: item.material ?? "",
    colour: item.primaryColour ?? "",
  };
}

export function catalogEntryToMasterBody(entry: InventoryCatalogEntry): {
  productGroup: string;
  attribute1: string;
  attribute2: string;
  attribute3: string;
  material: string;
  primaryColour: string;
} {
  return {
    productGroup: entry.productGroup,
    attribute1: entry.profileType,
    attribute2: entry.meshSpec,
    attribute3: entry.dimension,
    material: entry.resin,
    primaryColour: entry.colour,
  };
}

export function matchingCatalogItems(
  catalog: InventoryCatalogEntry[],
  line: {
    category?: string | null;
    profileType?: string | null;
    size?: string | null;
    materialGrade?: string | null;
  }
): InventoryCatalogEntry[] {
  const category = (line.category ?? "").trim();
  const profileType = (line.profileType ?? "").trim();
  const { meshSpec, dimension } = splitCatalogSize(line.size ?? "");
  const { resin, colour } = splitCatalogMaterialGrade(line.materialGrade ?? "");
  return catalog.filter(
    (item) =>
      item.productGroup === category &&
      item.profileType === profileType &&
      item.meshSpec === meshSpec &&
      item.dimension === dimension &&
      item.resin === resin &&
      item.colour === colour
  );
}

export function resolveCatalogItem(
  catalog: InventoryCatalogItem[],
  line: {
    category?: string | null;
    profileType?: string | null;
    size?: string | null;
    materialGrade?: string | null;
  }
): InventoryCatalogItem | null {
  const matches = matchingCatalogItems(catalog, line);
  return matches.length === 1 ? (matches[0] as InventoryCatalogItem) : null;
}
