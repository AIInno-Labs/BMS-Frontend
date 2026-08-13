"use client";

import { Plus, X } from "lucide-react";
import { ModalField } from "@/components/JobEditModal";
import { emptyPoItemRow, type PoItemRow } from "@/lib/poLineItems";

export interface PoDetailsFormValue {
  orderNo: string;
  orderDate: string;
  buyerName: string;
  expectedDate: string;
}

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

      {items.map((item, index) => (
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
            label="PO quantity"
            value={item.quantity}
            onChange={(v) =>
              onItemsChange(items.map((it, i) => (i === index ? { ...it, quantity: v } : it)))
            }
          />
          <ModalField
            label="PO price"
            value={item.price}
            onChange={(v) =>
              onItemsChange(items.map((it, i) => (i === index ? { ...it, price: v } : it)))
            }
          />
          <ModalField
            label="PO description"
            value={item.description}
            onChange={(v) =>
              onItemsChange(items.map((it, i) => (i === index ? { ...it, description: v } : it)))
            }
            multiline
          />
        </div>
      ))}
    </>
  );
}
