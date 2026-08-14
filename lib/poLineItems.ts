import type { FrpManualPoLineItemRequest } from "@/lib/frp/job-mapper";

/**
 * Row shape + JSON-building helpers for a manually-entered PO's line items.
 * Shared by the Document Versions "Add PO"/"Edit PO" modals and the Status
 * Control stage-tick modal (production stages), so there's one
 * implementation of "quantity/price/description rows → extract-schema
 * lineItems" instead of one per modal.
 */
export interface PoItemRow {
  sourceCode: string;
  quantity: string;
  price: string;
  description: string;
}

export function emptyPoItemRow(): PoItemRow {
  return { sourceCode: "", quantity: "", price: "", description: "" };
}

export function parseMoneyLike(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseQtyLike(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Row → extract-schema line item; drops rows left completely blank. */
export function lineItemsFromRows(items: PoItemRow[]): Record<string, unknown>[] {
  return items
    .filter(
      (it) =>
        it.sourceCode.trim() ||
        it.quantity.trim() ||
        it.price.trim() ||
        it.description.trim()
    )
    .map((it) => ({
      sourceCode: it.sourceCode.trim() || undefined,
      quantity: parseQtyLike(it.quantity),
      unitPrice: parseMoneyLike(it.price),
      lineTotal: parseMoneyLike(it.price),
      description: it.description.trim(),
    }));
}

/** Row → `ManualPoLineItemRequest`. `lineTotal` is omitted so the server
 *  derives `quantity × price`. */
export function manualPoLineItemsFromRows(
  items: PoItemRow[]
): FrpManualPoLineItemRequest[] {
  return items
    .filter(
      (it) =>
        it.sourceCode.trim() ||
        it.quantity.trim() ||
        it.price.trim() ||
        it.description.trim()
    )
    .map((it) => ({
      sourceCode: it.sourceCode.trim() || undefined,
      description: it.description.trim() || undefined,
      quantity: it.quantity.trim() ? parseQtyLike(it.quantity) : undefined,
      price: it.price.trim() ? parseMoneyLike(it.price) : undefined,
    }));
}

/** Each row's price rolls up into the document's overall total — there's no
 *  separate grand-total field to fill in by hand. */
export function totalPriceFromRows(items: PoItemRow[]): number {
  return items.reduce((sum, it) => sum + parseMoneyLike(it.price), 0);
}

const ITEM_CODE_KEYS = [
  "sourceCode",
  "item_code",
  "itemCode",
  "code",
  "sku",
  "product_code",
  "id",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asMapList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
}

function itemCodeFromLine(item: Record<string, unknown>): string | null {
  for (const key of ITEM_CODE_KEYS) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Distinct item codes from a typed PO form, joined for display / `documentName`. */
export function itemCodesLabelFromRows(items: PoItemRow[]): string | null {
  const unique = [...new Set(items.map((it) => it.sourceCode.trim()).filter(Boolean))];
  return unique.length ? unique.join(" · ") : null;
}

/** Distinct item codes from stored extract-schema `lineItems`. */
export function itemCodesLabelFromData(
  data: Record<string, unknown> | null | undefined
): string | null {
  const unique = [
    ...new Set(
      asMapList(asRecord(data).lineItems)
        .map(itemCodeFromLine)
        .filter((c): c is string => !!c)
    ),
  ];
  return unique.length ? unique.join(" · ") : null;
}

type PoLabelDoc = {
  extractionStatus?: string;
  documentName?: string;
  mimeType?: string | null;
  documentData?: Record<string, unknown> | null;
  editedDocumentData?: Record<string, unknown> | null;
};

export function isManualPoDocument(doc: PoLabelDoc): boolean {
  if (doc.extractionStatus === "SKIPPED") return true;
  const data = doc.editedDocumentData ?? doc.documentData;
  return asRecord(data).entrySource === "MANUAL";
}

/**
 * Label for a PO in lists / the paperclip row. Manual entries show item
 * codes (e.g. `ABC-123`) instead of document type or "Manual PO".
 */
export function poDocumentDisplayName(
  doc: PoLabelDoc,
  extraData?: Record<string, unknown> | null,
  fallback = "Document"
): string {
  const data = extraData ?? doc.editedDocumentData ?? doc.documentData;
  if (isManualPoDocument(doc) || asRecord(data).entrySource === "MANUAL") {
    return itemCodesLabelFromData(data) || doc.documentName?.trim() || "Manual PO";
  }
  return doc.documentName?.trim() || fallback;
}

/** Persist item codes as `documentName` so lists that only have the name still
 *  show `ABC-123`. Falls back to order number when no codes were typed. */
export function manualPoDocumentNameFromRows(
  orderNo: string,
  items: PoItemRow[]
): string | undefined {
  return itemCodesLabelFromRows(items) || orderNo.trim() || undefined;
}
