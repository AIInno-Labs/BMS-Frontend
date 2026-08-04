"use client";

import { FormEvent, useEffect, useState } from "react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { updateOrganization } from "@/lib/frp/api";
import type { OrganizationDTO } from "@/lib/frp/types";
import { FrpApiError } from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

interface EditOrganizationDrawerProps {
  open: boolean;
  organization: OrganizationDTO | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditOrganizationDrawer({
  open,
  organization,
  onClose,
  onUpdated,
}: EditOrganizationDrawerProps) {
  const [form, setForm] = useState<OrganizationDTO>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (organization) setForm({ ...organization });
  }, [organization]);

  function setField<K extends keyof OrganizationDTO>(key: K, value: OrganizationDTO[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.id) {
      setError("Organization id is required for update.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateOrganization({
        id: form.id,
        companyName: form.companyName?.trim(),
        companyCode: form.companyCode?.trim(),
        address: form.address?.trim() || undefined,
        city: form.city?.trim() || undefined,
        country: form.country?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        mobileNumber: form.mobileNumber?.trim() || undefined,
        email: form.email?.trim() || undefined,
        gstNo: form.gstNo?.trim() || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof FrpApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update organization"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EnterpriseDrawer
      open={open}
      onClose={onClose}
      title="Update organization"
      subtitle="Edit tenant company details."
      panelClassName="md:w-[48%] md:max-w-[640px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-org-form"
            className="btn-primary disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      <form id="edit-org-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="edit-companyName">
            Company name
          </label>
          <input
            id="edit-companyName"
            className={inputClass}
            required
            value={form.companyName ?? ""}
            onChange={(e) => setField("companyName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-companyCode">
            Company code
          </label>
          <input
            id="edit-companyCode"
            className={inputClass}
            required
            value={form.companyCode ?? ""}
            onChange={(e) => setField("companyCode", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-gstNo">
            GST no
          </label>
          <input
            id="edit-gstNo"
            className={inputClass}
            value={form.gstNo ?? ""}
            onChange={(e) => setField("gstNo", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="edit-address">
            Address
          </label>
          <input
            id="edit-address"
            className={inputClass}
            value={form.address ?? ""}
            onChange={(e) => setField("address", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-city">
            City
          </label>
          <input
            id="edit-city"
            className={inputClass}
            value={form.city ?? ""}
            onChange={(e) => setField("city", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-country">
            Country
          </label>
          <input
            id="edit-country"
            className={inputClass}
            value={form.country ?? ""}
            onChange={(e) => setField("country", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-email">
            Email
          </label>
          <input
            id="edit-email"
            type="email"
            className={inputClass}
            value={form.email ?? ""}
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-phone">
            Phone
          </label>
          <input
            id="edit-phone"
            className={inputClass}
            value={form.phone ?? ""}
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>
        {error && (
          <p className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </EnterpriseDrawer>
  );
}
