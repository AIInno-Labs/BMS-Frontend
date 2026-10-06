import { z } from "zod";
import { decimalField } from "@/lib/schemas/shared";

/** A single item row from the Create New Job drawer's Items step. */
export const JobItemRowSchema = z.object({
  itemCode: z.string().trim().optional(),
  itemName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  quantity: decimalField,
  unitPrice: decimalField,
});
