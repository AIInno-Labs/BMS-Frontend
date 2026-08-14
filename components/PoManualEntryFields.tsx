"use client";

import { Plus, X } from "lucide-react";
import { ModalField } from "@/components/JobEditModal";
import { emptyPoItemRow, type PoItemRow } from "@/lib/poLineItems";
import { PoItemRowSchema } from "@/lib/schemas/po";

export interface PoDetailsFormValue {
  orderNo: string;
  orderDate: string;
  buyerName: string;
  expectedDate: string;
  /** ISO 4217 code. Empty until the operator picks one — never invent AUD. */
  currency: string;
}

const CURRENCY_OPTIONS = [
  "AUD",
  "USD",
  "NZD",
  "GBP",
  "EUR",
  "INR",
  "SAR",
  "AED",
  "CAD",
] as const;

const fieldClass =
  "mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-orange-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

/**
 * Order metadata + repeatable line items for a manually-entered PO (no file
 * attached). Shared by the Document Versions "Add PO"/"Edit PO" modals and
 * the Status Control stage-tick modal (production stages only), so there's
 * one implementation of "type in a PO by hand" instead of three.
 */
export function PoManualEntryFields({
  details,
  onDetailsChange,
  orderNoEditable = true,
  items,
  onItemsChange,
}: {
  details: PoDetailsFormValue;
  onDetailsChange: (value: PoDetailsFormValue) => void;
  /** Add PO allows setting it; Edit PO keeps it locked once a doc exists. */
  orderNoEditable?: boolean;
  items: PoItemRow[];
  onItemsChange: (value: PoItemRow[]) => void;
}) {
  return (
    <>
      <ModalField
        label="Order No"
        value={details.orderNo}
        onChange={(v) => onDetailsChange({ ...details, orderNo: v })}
        placeholder="e.g. PO-248074"
        disabled={!orderNoEditable}
      />
      <ModalField
        label="Order Date"
        type="date"
        value={details.orderDate}
        onChange={(v) => onDetailsChange({ ...details, orderDate: v })}
      />
      <ModalField label="Buyer Name" value={details.buyerName} onChange={() => {}} disabled />
      <ModalField
        label="Expected Date"
        type="date"
        value={details.expectedDate}
        onChange={(v) => onDetailsChange({ ...details, expectedDate: v })}
      />
      <label className="block text-sm font-medium text-slate-700">
        Currency
        <select
          value={details.currency}
          onChange={(e) => onDetailsChange({ ...details, currency: e.target.value })}
          className={fieldClass}
        >
          <option value="">Choose currency</option>
          {CURRENCY_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Line items
        </p>
        <button
          type="button"
          onClick={() => onItemsChange([...items, emptyPoItemRow()])}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 hover:text-orange-800"
        >
          <Plus className="h-3 w-3" />
          Add item
        </button>
      </div>

      {items.map((item, index) => {
        const quantityCheck = PoItemRowSchema.shape.quantity.safeParse(item.quantity);
        const priceCheck = PoItemRowSchema.shape.price.safeParse(item.price);
        return (
          <div
            key={index}
            className="space-y-2 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Item {index + 1}</span>
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
                  className="rounded-md p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove item ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <ModalField
              label="Item code"
              value={item.sourceCode}
              onChange={(v) =>
                onItemsChange(items.map((it, i) => (i === index ? { ...it, sourceCode: v } : it)))
              }
              placeholder="e.g. ABC-001"
            />
            <ModalField
              label="PO quantity"
              value={item.quantity}
              onChange={(v) =>
                onItemsChange(items.map((it, i) => (i === index ? { ...it, quantity: v } : it)))
              }
              placeholder="e.g. 12"
              error={quantityCheck.success ? undefined : quantityCheck.error.issues[0]?.message}
            />
            <ModalField
              label="PO price"
              value={item.price}
              onChange={(v) =>
                onItemsChange(items.map((it, i) => (i === index ? { ...it, price: v } : it)))
              }
              placeholder="Unit price, e.g. 1250"
              error={priceCheck.success ? undefined : priceCheck.error.issues[0]?.message}
            />
            <ModalField
              label="PO description"
              value={item.description}
              onChange={(v) =>
                onItemsChange(items.map((it, i) => (i === index ? { ...it, description: v } : it)))
              }
              placeholder="e.g. FRP grating as per drawing C59807"
              multiline
            />
          </div>
        );
      })}
    </>
  );
}
