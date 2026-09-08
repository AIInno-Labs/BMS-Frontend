import { z } from "zod";
import { decimalField } from "@/lib/schemas/shared";

/** A single PO line item row from the Add PO / Edit PO manual-entry forms. */
export const PoItemRowSchema = z.object({
  sourceCode: z.string().trim().optional(),
  quantity: decimalField,
  price: decimalField,
  description: z.string().trim().optional(),
});
