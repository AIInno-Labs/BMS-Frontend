import { z } from "zod";
import { personNameField, phoneField, requiredEmailField } from "@/lib/schemas/shared";

export const CreateUserSchema = z.object({
  email: requiredEmailField,
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: personNameField,
  mobileNumber: phoneField,
});

/** Password is optional here — blank means "keep the current password." */
export const EditUserSchema = z.object({
  displayName: personNameField,
  mobileNumber: phoneField,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),
});
