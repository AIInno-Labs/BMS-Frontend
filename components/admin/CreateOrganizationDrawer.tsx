"use client";

import { FormEvent, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { createOrganization } from "@/lib/frp/api";
import type { CreateOrganizationRequest } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

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
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof CreateOrganizationRequest>(
    key: K,
    value: CreateOrganizationRequest[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setError(null);
    setForm(emptyForm);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: CreateOrganizationRequest = {
        ...form,
        companyName: form.companyName.trim(),
        companyCode: form.companyCode.trim(),
        adminEmail: form.adminEmail.trim(),
        adminDisplayName: form.adminDisplayName.trim(),
        email: form.email?.trim() || undefined,
        address: form.address?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        mobileNumber: form.mobileNumber?.trim() || undefined,
        gstNo: form.gstNo?.trim() || undefined,
        adminMobileNumber: form.adminMobileNumber?.trim() || undefined,
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
      <form id="create-org-form" onSubmit={onSubmit} className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Organization
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Organization admin
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
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
