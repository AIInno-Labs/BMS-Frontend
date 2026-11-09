import { z } from "zod";

/**
 * Optional phone/mobile number: digits only, with an optional leading "+"
 * for a country code. No fixed length — the target country isn't decided
 * yet, so length can be tightened later in this one place.
 */
export const phoneField = z
  .string()
  .trim()
  .regex(/^\+?\d+$/, "Numbers only (optional + at the start)")
  .optional()
  .or(z.literal(""));

/** A person's name: letters, spaces, and common name punctuation only — no digits or other symbols. */
export const personNameField = z
  .string()
  .trim()
  .min(1, "Name is required")
  .regex(/^[A-Za-z\s.'-]+$/, "Numbers and symbols aren't allowed");

export const requiredEmailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const optionalEmailField = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .optional()
  .or(z.literal(""));

/** A plain non-negative number as typed in a manual-entry form: decimals
 *  allowed (e.g. "12", "12.5", ".5") — no currency symbols, commas, or
 *  letters. Blank is fine since a row can be left partly filled in. */
export const decimalField = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d+)?|\.\d+)$/, "Numbers only (decimals allowed)")
  .optional()
  .or(z.literal(""));

/** Flattens the first ZodError issue per field into a simple {field: message} map. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
