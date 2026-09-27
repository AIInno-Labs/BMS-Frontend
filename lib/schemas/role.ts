import { z } from "zod";
import { personNameField } from "@/lib/schemas/shared";

export const RoleNameSchema = z.object({
  role: personNameField,
});

export const CreateRoleSchema = RoleNameSchema.extend({
  roleCode: z
    .string()
    .trim()
    .min(1, "Role code is required")
    .regex(/^[A-Z0-9_]+$/i, "Letters, digits and underscore only"),
});
