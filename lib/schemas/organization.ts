import { z } from "zod";
import {
  optionalEmailField,
  personNameField,
  phoneField,
  requiredEmailField,
} from "@/lib/schemas/shared";
import { ORG_CURRENCY_OPTIONS } from "@/lib/frp/format-money";

const currencyField = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (code): code is (typeof ORG_CURRENCY_OPTIONS)[number] =>
      (ORG_CURRENCY_OPTIONS as readonly string[]).includes(code),
    { message: "Select a currency" }
  );

const orgFields = {
  companyName: z.string().trim().min(1, "Company name is required"),
  companyCode: z.string().trim().min(1, "Company code is required"),
  gstNo: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  email: optionalEmailField,
  phone: phoneField,
  mobileNumber: phoneField,
  currency: currencyField,
};

export const OrganizationSchema = z.object({
  ...orgFields,
  adminDisplayName: personNameField,
  adminEmail: requiredEmailField,
  adminMobileNumber: phoneField,
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/** Editing an org doesn't touch its admin account, so this drops the admin-only fields. */
export const EditOrganizationSchema = z.object(orgFields);
