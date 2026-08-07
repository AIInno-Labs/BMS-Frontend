"use client";

import { FormEvent, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { createOrganization } from "@/lib/frp/api";
import type { CreateOrganizationRequest } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";
import { OrganizationSchema } from "@/lib/schemas/organization";
import { fieldErrorsFrom } from "@/lib/schemas/shared";

const inputClass =
  "mt-2 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const emptyForm: CreateOrganizationRequest = {
  companyName: "",
  companyCode: "",
  address: "",
  city: "",
  country: "",
  postalCode: "",
  phone: "",
  mobileNumber: "",
  email: "",
  gstNo: "",
  adminPassword: "",
  adminEmail: "",
  adminDisplayName: "",
  adminMobileNumber: "",
};

interface CreateOrganizationDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateOrganizationDrawer({
  open,
  onClose,
  onCreated,
}: CreateOrganizationDrawerProps) {
  const [form, setForm] = useState<CreateOrganizationRequest>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof CreateOrganizationRequest>(
    key: K,
    value: CreateOrganizationRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setError(null);
    setFieldErrors({});
    setForm(emptyForm);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = OrganizationSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      const data = parsed.data;
      const payload: CreateOrganizationRequest = {
        ...form,
        companyName: data.companyName,
        companyCode: data.companyCode,
        adminEmail: data.adminEmail,
        adminDisplayName: data.adminDisplayName,
        email: data.email || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        postalCode: data.postalCode || undefined,
        phone: data.phone || undefined,
        mobileNumber: data.mobileNumber || undefined,
        gstNo: data.gstNo || undefined,
        adminMobileNumber: data.adminMobileNumber || undefined,
      };
      await createOrganization(payload);
      setForm(emptyForm);
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create organization"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EnterpriseDrawer
      open={open}
      onClose={handleClose}
      title="Create organization"
      subtitle="Provision a tenant and its organization admin."
      panelClassName="md:w-[min(640px,92vw)]"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-org-form"
            className="btn-primary w-full disabled:opacity-60 sm:w-auto"
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create organization"}
          </button>
        </div>
      }
    >
      <form id="create-org-form" onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Organization
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-4">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="companyName">
                Company name *
              </label>
              <input
                id="companyName"
                className={inputClass}
                required
                value={form.companyName}
                onChange={(e) => setField("companyName", e.target.value)}
              />
              <FieldError message={fieldErrors.companyName} />
            </div>
            <div>
              <label className={labelClass} htmlFor="companyCode">
                Company code *
              </label>
              <input
                id="companyCode"
                className={inputClass}
                required
                value={form.companyCode}
                onChange={(e) => setField("companyCode", e.target.value)}
              />
              <FieldError message={fieldErrors.companyCode} />
            </div>
            <div>
              <label className={labelClass} htmlFor="gstNo">
                GST no
              </label>
              <input
                id="gstNo"
                className={inputClass}
                value={form.gstNo}
                onChange={(e) => setField("gstNo", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="address">
                Address
              </label>
              <input
                id="address"
                className={inputClass}
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="city">
                City
              </label>
              <input
                id="city"
                className={inputClass}
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="country">
                Country
              </label>
              <input
                id="country"
                className={inputClass}
                value={form.country}
                onChange={(e) => setField("country", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="postalCode">
                Postal code
              </label>
              <input
                id="postalCode"
                className={inputClass}
                value={form.postalCode}
                onChange={(e) => setField("postalCode", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div>
              <label className={labelClass} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                className={inputClass}
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
              <FieldError message={fieldErrors.phone} />
            </div>
            <div>
              <label className={labelClass} htmlFor="mobileNumber">
                Mobile
              </label>
              <input
                id="mobileNumber"
                className={inputClass}
                value={form.mobileNumber}
                onChange={(e) => setField("mobileNumber", e.target.value)}
              />
              <FieldError message={fieldErrors.mobileNumber} />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Organization admin
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-4">
            <div>
              <label className={labelClass} htmlFor="adminDisplayName">
                Display name *
              </label>
              <input
                id="adminDisplayName"
                className={inputClass}
                required
                value={form.adminDisplayName}
                onChange={(e) => setField("adminDisplayName", e.target.value)}
              />
              <FieldError message={fieldErrors.adminDisplayName} />
            </div>
            <div>
              <label className={labelClass} htmlFor="adminEmail">
                Email *
              </label>
              <input
                id="adminEmail"
                type="email"
                className={inputClass}
                required
                value={form.adminEmail}
                onChange={(e) => setField("adminEmail", e.target.value)}
              />
              <FieldError message={fieldErrors.adminEmail} />
            </div>
            <div>
              <label className={labelClass} htmlFor="adminMobileNumber">
                Mobile
              </label>
              <input
                id="adminMobileNumber"
                className={inputClass}
                value={form.adminMobileNumber}
                onChange={(e) => setField("adminMobileNumber", e.target.value)}
              />
              <FieldError message={fieldErrors.adminMobileNumber} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="adminPassword">
                Password * (min 8)
              </label>
              <input
                id="adminPassword"
                type="password"
                className={inputClass}
                required
                minLength={8}
                value={form.adminPassword}
                onChange={(e) => setField("adminPassword", e.target.value)}
              />
              <FieldError message={fieldErrors.adminPassword} />
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </EnterpriseDrawer>
  );
}
