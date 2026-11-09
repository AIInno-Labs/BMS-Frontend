import { z } from "zod";

export const PrivilegeSchema = z
  .object({
    privilegeType: z.enum(["MENU", "FIELD"]),
    privilege: z.string().trim().min(1, "Label is required"),
    privilegeCode: z.string().trim().min(1, "Code is required"),
    domain: z.string().trim().optional(),
    fieldKey: z.string().trim().optional(),
    accessMode: z.enum(["READ", "WRITE"]).optional(),
    sortOrder: z.coerce.number().int("Sort order must be a whole number"),
  })
  .superRefine((data, ctx) => {
    if (data.privilegeType === "FIELD" && !data.fieldKey?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["fieldKey"],
        message: "Field key is required for FIELD privileges",
      });
    }
  });

/** Editing a privilege can't change its type, so this only checks the fields that stay editable. */
export const EditPrivilegeSchema = z
  .object({
    isFieldType: z.boolean(),
    label: z.string().trim().min(1, "Label is required"),
    domain: z.string().trim().optional(),
    fieldKey: z.string().trim().optional(),
    sortOrder: z.coerce.number().int("Sort order must be a whole number"),
  })
  .superRefine((data, ctx) => {
    if (data.isFieldType && !data.fieldKey?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["fieldKey"],
        message: "Field key is required for FIELD privileges",
      });
    }
  });
