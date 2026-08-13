/**
 * Row shape + JSON-building helpers for a manually-entered PO's line items.
 * Shared by the Document Versions "Add PO"/"Edit PO" modals and the Status
 * Control stage-tick modal (production stages), so there's one
 * implementation of "quantity/price/description rows → extract-schema
 * lineItems" instead of one per modal.
 */
export interface PoItemRow {
  quantity: string;
  price: string;
  description: string;
}

export function emptyPoItemRow(): PoItemRow {
  return { quantity: "", price: "", description: "" };
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
    .filter((it) => it.quantity.trim() || it.price.trim() || it.description.trim())
    .map((it) => ({
      quantity: parseQtyLike(it.quantity),
      unitPrice: parseMoneyLike(it.price),
      lineTotal: parseMoneyLike(it.price),
      description: it.description.trim(),
    }));
}

/** Each row's price rolls up into the document's overall total — there's no
 *  separate grand-total field to fill in by hand. */
export function totalPriceFromRows(items: PoItemRow[]): number {
  return items.reduce((sum, it) => sum + parseMoneyLike(it.price), 0);
}
