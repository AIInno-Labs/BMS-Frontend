import { z } from "zod";

const NUMERIC_MESSAGE = "Numbers only (decimals allowed)";

/** Quantity/price as typed in the PO manual-entry forms: a plain
 *  non-negative number, decimals allowed (e.g. "12", "12.5", ".5") — no
 *  currency symbols, commas, or letters. Blank is fine since a line item
 *  can be left partly filled in. */
const decimalField = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d+)?|\.\d+)$/, NUMERIC_MESSAGE)
  .optional()
  .or(z.literal(""));

/** A single PO line item row from the Add PO / Edit PO manual-entry forms. */
export const PoItemRowSchema = z.object({
  sourceCode: z.string().trim().optional(),
  quantity: decimalField,
  price: decimalField,
  description: z.string().trim().optional(),
});
