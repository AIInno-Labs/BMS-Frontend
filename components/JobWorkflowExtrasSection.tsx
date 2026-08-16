"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  FileText,
  Pencil,
  Truck,
} from "lucide-react";
import { JobFilesDocumentStrip } from "@/components/JobFilesDocumentStrip";
import type { JobFileRecord, JobFileSortMode } from "@/lib/jobFilesSort";
import {
  COLOUR_OPTIONS,
  FINISH_OPTIONS,
  MESH_OPTIONS,
  SCOPE_TYPE_OPTIONS,
  THICKNESS_OPTIONS,
  scopeLinesToText,
  textToScopeLines,
} from "@/lib/jobCardFormDefaults";
import {
  appendProgramHistory,
  ensureWorkflowExtras,
  JOB_TYPE_OPTIONS,
  PRODUCTION_STATUS_OPTIONS,
  SHIPMENT_METHOD_OPTIONS,
} from "@/lib/jobWorkflowExtras";
import { formatShortDate } from "@/lib/mockData";
import { isCancelledJob } from "@/lib/frp/job-status";
import type { JobUpdateAuditAction } from "@/lib/frp/job-mapper";
import type { Job, JobCardPrintDetails, JobMaterialRow, JobWorkflowExtras } from "@/lib/types";
import { getAssignableWorkers } from "@/lib/workers";

interface JobWorkflowExtrasSectionProps {
  job: Job;
  pd: JobCardPrintDetails;
  isSaving: boolean;
  onSavePatch: (
    patch: Partial<Job>,
    options?: { audit?: JobUpdateAuditAction; auditDetail?: string | null }
  ) => Promise<void>;
  files: JobFileRecord[];
  fileSort: JobFileSortMode;
  onFileSortChange: (mode: JobFileSortMode) => void;
  onUploadFile: () => void;
  onDownloadFile: (file: JobFileRecord) => void;
  onOpenFile?: (file: JobFileRecord) => void;
  /** Detail-panel "Download" for versioned PO/drawing docs. */
  onDownloadVersionFile?: (file: JobFileRecord) => void;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function JobWorkflowExtrasSection({
  job,
  pd,
  isSaving,
  onSavePatch,
  files,
  fileSort,
  onFileSortChange,
  onUploadFile,
  onDownloadFile,
  onOpenFile,
  onDownloadVersionFile,
}: JobWorkflowExtrasSectionProps) {
  const cancelled = isCancelledJob(job.status);
  const extras = ensureWorkflowExtras(pd.workflowExtras, job);
  const workers = getAssignableWorkers();

  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [logisticsDraft, setLogisticsDraft] = useState({
    productionStatus: extras.productionStatus ?? "",
    responsibleParty: extras.responsibleParty ?? "",
    accountable: extras.accountable ?? "",
    contactName: job.clientContactName,
    contactEmail: pd.contactEmail ?? "",
    shipDate: pd.despatchDate ?? "",
    shipmentMethod: extras.shipmentMethod ?? "",
    freightAccount: pd.freightAccount ?? "",
    carrierAccount: extras.carrierAccount ?? "",
    billingAddress: extras.billingAddress ?? "",
    deliveryAddress: extras.deliveryAddress ?? "",
  });
  const [materialsDraft, setMaterialsDraft] = useState({
    materialsList: extras.materialsList ?? "",
    scopeType: pd.scopeType ?? "",
    thickness: pd.thickness ?? "",
    mesh: pd.mesh ?? "",
    colour: pd.colour ?? "",
    finish: pd.finish ?? "",
    materialRows: extras.materialRows ?? [],
    customFields: extras.customFields ?? Array(9).fill(""),
    additionalNotes: extras.additionalNotes ?? "",
  });

  useEffect(() => {
    const x = ensureWorkflowExtras(pd.workflowExtras, job);
    setLogisticsDraft({
      productionStatus: x.productionStatus ?? "",
      responsibleParty: x.responsibleParty ?? "",
      accountable: x.accountable ?? "",
      contactName: job.clientContactName,
      contactEmail: pd.contactEmail ?? "",
      shipDate: pd.despatchDate ?? "",
      shipmentMethod: x.shipmentMethod ?? "",
      freightAccount: pd.freightAccount ?? "",
      carrierAccount: x.carrierAccount ?? "",
      billingAddress: x.billingAddress ?? "",
      deliveryAddress: x.deliveryAddress ?? "",
    });
    setMaterialsDraft({
      materialsList: x.materialsList ?? "",
      scopeType: pd.scopeType ?? "",
      thickness: pd.thickness ?? "",
      mesh: pd.mesh ?? "",
      colour: pd.colour ?? "",
      finish: pd.finish ?? "",
      materialRows: x.materialRows ?? [],
      customFields: x.customFields ?? Array(9).fill(""),
      additionalNotes: x.additionalNotes ?? "",
    });
  }, [job, pd]);

  const saveExtras = async (
    nextExtras: JobWorkflowExtras,
    printPatch?: Partial<JobCardPrintDetails>,
    historyLine?: string
  ) => {
    let merged = nextExtras;
    if (historyLine) {
      merged = appendProgramHistory(merged, historyLine);
    }
    await onSavePatch({
      printDetails: {
        ...pd,
        ...printPatch,
        workflowExtras: merged,
      },
    });
  };

  const patchRequirements = async (
    key: "documentsRequired" | "sampleRequired" | "coiRequired",
    value: boolean
  ) => {
    const next = { ...extras, [key]: value };
    const label =
      key === "documentsRequired"
        ? "Documents required"
        : key === "sampleRequired"
          ? "Sample required"
          : "COI required";
    await saveExtras(
      next,
      undefined,
      `${label} ${value ? "enabled" : "disabled"}`
    );
  };

  const saveLogistics = () => {
    const nextExtras: JobWorkflowExtras = {
      ...extras,
      productionStatus: logisticsDraft.productionStatus,
      responsibleParty: logisticsDraft.responsibleParty,
      accountable: logisticsDraft.accountable,
      shipmentMethod: logisticsDraft.shipmentMethod,
      carrierAccount: logisticsDraft.carrierAccount,
      billingAddress: logisticsDraft.billingAddress,
      deliveryAddress: logisticsDraft.deliveryAddress,
    };
    const withHistory = appendProgramHistory(
      nextExtras,
      "Scheduling & logistics updated"
    );
    void onSavePatch({
      clientContactName: logisticsDraft.contactName.trim(),
      printDetails: {
        ...pd,
        despatchDate: logisticsDraft.shipDate,
        freightAccount: logisticsDraft.freightAccount,
        contactEmail: logisticsDraft.contactEmail,
        deliveryInstructions: logisticsDraft.deliveryAddress,
        workflowExtras: withHistory,
      },
    }).then(() => setShowLogisticsModal(false));
  };

  const saveMaterials = () => {
    const nextExtras: JobWorkflowExtras = {
      ...extras,
      materialsList: materialsDraft.materialsList,
      materialRows: materialsDraft.materialRows,
      customFields: materialsDraft.customFields,
      additionalNotes: materialsDraft.additionalNotes,
    };
    void saveExtras(
      nextExtras,
      {
        scopeType: materialsDraft.scopeType,
        thickness: materialsDraft.thickness,
        mesh: materialsDraft.mesh,
        colour: materialsDraft.colour,
        finish: materialsDraft.finish,
        scopeLines: textToScopeLines(materialsDraft.materialsList),
      },
      "Materials & specifications updated"
    ).then(() => setShowMaterialsModal(false));
  };

  const updateMaterialRow = (
    index: number,
    patch: Partial<JobMaterialRow>
  ) => {
    setMaterialsDraft((prev) => ({
      ...prev,
      materialRows: prev.materialRows.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }));
  };

  return (
    <>
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="app-card-interactive p-4">
          <p className="text-sm font-semibold text-[#111827]">Project requirements</p>
          <div className="mt-3 space-y-2">
            {(
              [
                ["documentsRequired", "Documents required"],
                ["sampleRequired", "Sample required"],
                ["coiRequired", "COI required"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={Boolean(extras[key])}
                  onChange={(e) => void patchRequirements(key, e.target.checked)}
                  disabled={isSaving || cancelled}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Job type:{" "}
            <span className="font-medium text-slate-700">
              {job.jobType || extras.jobType || "—"}
            </span>
            {extras.projectedStartDate ? (
              <>
                {" "}
                · Start: {formatShortDate(extras.projectedStartDate)}
              </>
            ) : null}
          </p>
        </article>

        <WidgetCard
          title="Scheduling & logistics"
          icon={Truck}
          onEdit={cancelled ? undefined : () => setShowLogisticsModal(true)}
        >
          <Row label="Production status" value={extras.productionStatus || "—"} />
          <Row label="Responsible" value={extras.responsibleParty || "—"} />
          <Row label="Accountable" value={extras.accountable || "—"} />
          <Row
            label="Ship date"
            value={pd.despatchDate ? formatShortDate(pd.despatchDate) : "Not set"}
          />
          <Row label="Shipment" value={extras.shipmentMethod || "—"} />
          <Row label="Freight acct" value={pd.freightAccount || "—"} />
        </WidgetCard>

        <WidgetCard
          title="Materials & specifications"
          icon={ClipboardList}
          onEdit={cancelled ? undefined : () => setShowMaterialsModal(true)}
        >
          <p className="line-clamp-3 text-sm text-slate-600">
            {extras.materialsList?.trim() || scopeLinesToText(pd.scopeLines) || "No materials list."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {pd.scopeType || "—"} · {pd.thickness || "—"} mm · {pd.mesh || "—"} ·{" "}
            {pd.colour || "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {(extras.materialRows ?? []).filter((r) => r.qty?.trim()).length} material line(s) with
            qty
          </p>
        </WidgetCard>

        <JobFilesDocumentStrip
          variant="full"
          jobId={job.id}
          files={files}
          fileSort={fileSort}
          onFileSortChange={onFileSortChange}
          onUpload={cancelled ? undefined : onUploadFile}
          onDownload={onDownloadFile}
          onOpenFile={onOpenFile}
          onDownloadVersionFile={onDownloadVersionFile}
        />
      </section>

      <EditModal
        open={showLogisticsModal}
        title="Edit scheduling & logistics"
        onClose={() => setShowLogisticsModal(false)}
        wide
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <SelectField
            label="Production status"
            value={logisticsDraft.productionStatus}
            options={[...PRODUCTION_STATUS_OPTIONS]}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, productionStatus: v }))}
          />
          <SelectField
            label="Responsible party"
            value={logisticsDraft.responsibleParty}
            options={["", ...workers.map((w) => w.display_name)]}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, responsibleParty: v }))}
          />
          <ModalField
            label="Accountable"
            value={logisticsDraft.accountable}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, accountable: v }))}
          />
          <ModalField
            label="Contact name"
            value={logisticsDraft.contactName}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, contactName: v }))}
          />
          <ModalField
            label="Contact email"
            value={logisticsDraft.contactEmail}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, contactEmail: v }))}
          />
          <div>
            <p className="text-sm font-medium text-slate-700">Ship date</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                type="date"
                value={logisticsDraft.shipDate}
                onChange={(e) =>
                  setLogisticsDraft((p) => ({ ...p, shipDate: e.target.value }))
                }
                className="flex-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  setLogisticsDraft((p) => ({ ...p, shipDate: addDaysIso(0) }))
                }
              >
                Today
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  setLogisticsDraft((p) => ({ ...p, shipDate: addDaysIso(1) }))
                }
              >
                +1D
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() =>
                  setLogisticsDraft((p) => ({ ...p, shipDate: addDaysIso(2) }))
                }
              >
                +2D
              </button>
            </div>
          </div>
          <SelectField
            label="Shipment method"
            value={logisticsDraft.shipmentMethod}
            options={[...SHIPMENT_METHOD_OPTIONS]}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, shipmentMethod: v }))}
          />
          <ModalField
            label="Freight account"
            value={logisticsDraft.freightAccount}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, freightAccount: v }))}
          />
          <ModalField
            label="Carrier account"
            value={logisticsDraft.carrierAccount}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, carrierAccount: v }))}
          />
          <TextAreaField
            label="Billing address"
            value={logisticsDraft.billingAddress}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, billingAddress: v }))}
          />
          <TextAreaField
            label="Delivery address"
            value={logisticsDraft.deliveryAddress}
            onChange={(v) => setLogisticsDraft((p) => ({ ...p, deliveryAddress: v }))}
          />
          <button className="btn-primary w-full" onClick={saveLogistics} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save logistics"}
          </button>
        </div>
      </EditModal>

      <EditModal
        open={showMaterialsModal}
        title="Edit materials & specifications"
        onClose={() => setShowMaterialsModal(false)}
        wide
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <TextAreaField
            label="List of materials for this job"
            value={materialsDraft.materialsList}
            onChange={(v) => setMaterialsDraft((p) => ({ ...p, materialsList: v }))}
            rows={4}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Type"
              value={materialsDraft.scopeType}
              options={[...SCOPE_TYPE_OPTIONS]}
              onChange={(v) => setMaterialsDraft((p) => ({ ...p, scopeType: v }))}
            />
            <SelectField
              label="Thickness (mm)"
              value={materialsDraft.thickness}
              options={[...THICKNESS_OPTIONS]}
              onChange={(v) => setMaterialsDraft((p) => ({ ...p, thickness: v }))}
            />
            <SelectField
              label="Mesh"
              value={materialsDraft.mesh}
              options={[...MESH_OPTIONS]}
              onChange={(v) => setMaterialsDraft((p) => ({ ...p, mesh: v }))}
            />
            <SelectField
              label="Colour"
              value={materialsDraft.colour}
              options={[...COLOUR_OPTIONS]}
              onChange={(v) => setMaterialsDraft((p) => ({ ...p, colour: v }))}
            />
            <SelectField
              label="Finish"
              value={materialsDraft.finish}
              options={[...FINISH_OPTIONS]}
              onChange={(v) => setMaterialsDraft((p) => ({ ...p, finish: v }))}
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 w-20">Qty</th>
                  <th className="px-3 py-2 w-28">Availability</th>
                </tr>
              </thead>
              <tbody>
                {materialsDraft.materialRows.map((row, index) => (
                  <tr key={row.material} className="border-t border-[#E5E7EB]">
                    <td className="px-3 py-2 font-medium text-slate-800">{row.material}</td>
                    <td className="px-2 py-1">
                      <input
                        value={row.qty}
                        onChange={(e) => updateMaterialRow(index, { qty: e.target.value })}
                        className="w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        value={row.availability}
                        onChange={(e) =>
                          updateMaterialRow(index, { availability: e.target.value })
                        }
                        className="w-full rounded border border-[#E5E7EB] px-2 py-1 text-sm"
                      >
                        <option value="In stock">In stock</option>
                        <option value="Low stock">Low stock</option>
                        <option value="On order">On order</option>
                        <option value="N/A">N/A</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Custom fields
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((col) => (
              <div key={col} className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Field {col + 1}</p>
                {[0, 1, 2].map((row) => {
                  const idx = col * 3 + row;
                  return (
                    <input
                      key={idx}
                      value={materialsDraft.customFields[idx] ?? ""}
                      onChange={(e) => {
                        const next = [...materialsDraft.customFields];
                        next[idx] = e.target.value;
                        setMaterialsDraft((p) => ({ ...p, customFields: next }));
                      }}
                      placeholder={`Row ${row + 1}`}
                      className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-sm"
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <TextAreaField
            label="Additional notes"
            value={materialsDraft.additionalNotes}
            onChange={(v) => setMaterialsDraft((p) => ({ ...p, additionalNotes: v }))}
            rows={3}
          />
          <button className="btn-primary w-full" onClick={saveMaterials} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save materials"}
          </button>
        </div>
      </EditModal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-slate-600">
      <span className="font-medium text-slate-800">{label}:</span> {value}
    </p>
  );
}

function WidgetCard({
  title,
  icon: Icon,
  children,
  onEdit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <article className="group app-card-interactive p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <Icon className="h-4 w-4 text-[#F97316]" />
          {title}
        </p>
        {onEdit && (
          <button
            type="button"
            className="rounded-lg border border-[#E5E7EB] p-1.5 text-slate-500 opacity-0 pointer-events-none transition-opacity duration-150 hover:border-orange-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus:opacity-100"
            onClick={onEdit}
            aria-label={`Edit ${title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-1">{children}</div>
    </article>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt || "empty"} value={opt}>
            {opt || "—"}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditModal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <div
        className={`glass-panel w-full rounded-2xl p-5 ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
          <button
            type="button"
            className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-slate-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
