import { z } from "zod";
import { requiredEmailField } from "@/lib/schemas/shared";

export const LoginSchema = z.object({
  email: requiredEmailField,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const MfaSchema = z.object({
  mfaCode: z
    .string()
    .trim()
    .min(6, "Code must be 6–8 digits")
    .max(8, "Code must be 6–8 digits")
    .regex(/^\d+$/, "Digits only"),
});
