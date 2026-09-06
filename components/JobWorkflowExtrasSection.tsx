"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  FileText,
  ListChecks,
  Pencil,
  Truck,
} from "lucide-react";
import { JobFilesDocumentStrip } from "@/components/JobFilesDocumentStrip";
import type { JobFileRecord, JobFileSortMode } from "@/lib/jobFilesSort";
import {
  scopeLinesToText,
  textToScopeLines,
} from "@/lib/jobCardFormDefaults";
import {
  appendProgramHistory,
  ensureWorkflowExtras,
  JOB_TYPE_OPTIONS,
  SHIPMENT_METHOD_OPTIONS,
  shipmentMethodToBackend,
  shipmentMethodToLabel,
} from "@/lib/jobWorkflowExtras";
import { formatShortDate } from "@/lib/mockData";
import { setJobRequirement, saveJobMeasurements } from "@/lib/frp/api";
import { isCancelledJob } from "@/lib/frp/job-status";
import { isJobLockedForCashPayment } from "@/lib/frp/job-cash-payment-gate";
import {
  PROJECT_REQUIREMENT_LABELS,
  type ProjectRequirementKind,
} from "@/lib/frp/project-requirements";
import { userIdToBackend, type JobUpdateAuditAction } from "@/lib/frp/job-mapper";
import type {
  Job,
  JobCardPrintDetails,
  JobProjectRequirement,
  JobSchedulingLogistics,
  JobWorkflowExtras,
} from "@/lib/types";
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
  /** PDF/image thumbnail click — parent opens the in-app preview modal. */
  onPreviewFile?: (file: JobFileRecord) => void;
  /** Detail-panel "Download" for versioned PO/drawing docs. */
  onDownloadVersionFile?: (file: JobFileRecord) => void;
  /** Called after a document is soft-deleted, so the parent can refetch the file list. */
  onDeletedFile?: () => void;
  /** SharePoint FAILED — parent shows delete-and-reupload guidance. */
  onFailedFile?: (file: JobFileRecord) => void;
  /** Refetch job after a dedicated API write (requirements, payment, …). */
  onJobChanged?: () => void | Promise<void>;
}

/** Every field null - the shape to spread over when a job has no row yet. */
const EMPTY_LOGISTICS: JobSchedulingLogistics = {
  jobStatus: null,
  responsiblePersonId: null,
  accountable: null,
  contactId: null,
  shipDate: null,
  shipmentMethod: null,
  freightAccount: null,
  carrierAccount: null,
  billingAddress: null,
  deliveryAddress: null,
};

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
  onPreviewFile,
  onDownloadVersionFile,
  onDeletedFile,
  onFailedFile,
  onJobChanged,
}: JobWorkflowExtrasSectionProps) {
  const cancelled = isCancelledJob(job.status);
  const cashPaymentLocked = isJobLockedForCashPayment(job);
  const editsBlocked = cancelled || cashPaymentLocked;
  const extras = ensureWorkflowExtras(pd.workflowExtras, job);
  const requirements = job.requirements ?? [];
  const workers = getAssignableWorkers();
  // Everything this panel shows comes from job_scheduling_logistics, the record
  // its own endpoint owns - except production status, which is the job's.
  // The job-card JSON still holds copies for the printed card, but reading
  // those was how the panel could show something the table did not have.
  const sl = job.schedulingLogistics ?? EMPTY_LOGISTICS;
  const responsibleName =
    workers.find((w) => userIdToBackend(w.id) === sl.responsiblePersonId)
      ?.display_name ?? "";

  const [requirementsBusy, setRequirementsBusy] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const [materialsBusy, setMaterialsBusy] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  // Seeded from the logistics record, so the form opens on what it will save.
  const [logisticsDraft, setLogisticsDraft] = useState({
    responsibleParty: responsibleName,
    accountable: sl.accountable ?? "",
    contactName: job.clientContactName,
    contactEmail: pd.contactEmail ?? "",
    shipDate: sl.shipDate ?? "",
    shipmentMethod: shipmentMethodToLabel(sl.shipmentMethod),
    freightAccount: sl.freightAccount ?? "",
    carrierAccount: sl.carrierAccount ?? "",
    billingAddress: sl.billingAddress ?? "",
    deliveryAddress: sl.deliveryAddress ?? "",
  });
  const [materialsDraft, setMaterialsDraft] = useState({
    materialsList: extras.materialsList ?? "",
    additionalNotes: extras.additionalNotes ?? "",
  });

  useEffect(() => {
    const x = ensureWorkflowExtras(pd.workflowExtras, job);
    // Same source as the initial state: the logistics record, not the card
    // JSON. Reseeding from the JSON here would have quietly undone an edit the
    // moment the job refetched.
    const next = job.schedulingLogistics ?? EMPTY_LOGISTICS;
    setLogisticsDraft({
      responsibleParty:
        workers.find((w) => userIdToBackend(w.id) === next.responsiblePersonId)
          ?.display_name ?? "",
      accountable: next.accountable ?? "",
      contactName: job.clientContactName,
      contactEmail: pd.contactEmail ?? "",
      shipDate: next.shipDate ?? "",
      shipmentMethod: shipmentMethodToLabel(next.shipmentMethod),
      freightAccount: next.freightAccount ?? "",
      carrierAccount: next.carrierAccount ?? "",
      billingAddress: next.billingAddress ?? "",
      deliveryAddress: next.deliveryAddress ?? "",
    });
    setMaterialsDraft({
      materialsList: x.materialsList ?? "",
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

  const patchRequirement = async (
    kind: ProjectRequirementKind,
    required: boolean
  ) => {
    if (!job.dbId) return;
    setRequirementsBusy(true);
    setRequirementsError(null);
    try {
      await setJobRequirement(job.dbId, kind, required);
      await onJobChanged?.();
    } catch (e) {
      setRequirementsError(
        e instanceof Error ? e.message : "Could not update project requirement"
      );
    } finally {
      setRequirementsBusy(false);
    }
  };

  const saveLogistics = () => {
    const nextExtras: JobWorkflowExtras = {
      ...extras,
      // productionStatus is not saved here: it mirrors the job's status, and
      // writing a copy back is what let the two disagree.
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
    // Written to both stores. job_scheduling_logistics is the real record -
    // JobsContext.updateJob PUTs it to /jobs/{id}/scheduling-logistics - while
    // the job-card JSON is what the printed card renders from. Saving only the
    // JSON, as this panel used to, left the table holding whatever it had when
    // the job was created.
    //
    // jobStatus and contactId are carried through untouched: this panel does
    // not own them, and sending null would clear them.
    const responsibleId = workers.find(
      (w) => w.display_name === logisticsDraft.responsibleParty
    )?.id;
    void onSavePatch({
      clientContactName: logisticsDraft.contactName.trim(),
      schedulingLogistics: {
        ...(job.schedulingLogistics ?? EMPTY_LOGISTICS),
        responsiblePersonId: userIdToBackend(responsibleId) ?? null,
        accountable: logisticsDraft.accountable || null,
        shipDate: logisticsDraft.shipDate || null,
        shipmentMethod: shipmentMethodToBackend(logisticsDraft.shipmentMethod),
        freightAccount: logisticsDraft.freightAccount || null,
        carrierAccount: logisticsDraft.carrierAccount || null,
        billingAddress: logisticsDraft.billingAddress || null,
        deliveryAddress: logisticsDraft.deliveryAddress || null,
      },
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
    if (!job.dbId) return;
    setMaterialsBusy(true);
    setMaterialsError(null);
    void saveJobMeasurements(job.dbId, {
      materials: { materialsList: materialsDraft.materialsList },
      notes: materialsDraft.additionalNotes,
    })
      .then(async () => {
        await onJobChanged?.();
        setShowMaterialsModal(false);
      })
      .catch((e) => {
        setMaterialsError(
          e instanceof Error ? e.message : "Could not save materials"
        );
      })
      .finally(() => setMaterialsBusy(false));
  };

  return (
    <>
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <WidgetCard title="Project Requirements" icon={ListChecks}>
          {requirementsError ? (
            <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {requirementsError}
            </p>
          ) : null}
          <div className="space-y-2">
            {requirements.map((row: JobProjectRequirement) => (
              <label
                key={row.kind}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={row.isRequired === true}
                  onChange={(e) =>
                    void patchRequirement(row.kind, e.target.checked)
                  }
                  disabled={
                    isSaving || requirementsBusy || cancelled || !job.dbId
                  }
                  className="h-4 w-4 rounded border-slate-300 text-orange-600"
                />
                {row.label || PROJECT_REQUIREMENT_LABELS[row.kind]}
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
        </WidgetCard>

        <WidgetCard
          title="Scheduling & logistics"
          icon={Truck}
          onEdit={editsBlocked ? undefined : () => setShowLogisticsModal(true)}
        >
          {/* The job's own status, not a separate logistics field. Two
              editable copies of "where is this job up to" drift apart, and the
              stage machinery already derives this one. */}
          <Row label="Production status" value={job.status || "—"} />
          <Row label="Responsible" value={responsibleName || "—"} />
          <Row label="Accountable" value={sl.accountable || "—"} />
          <Row
            label="Ship date"
            value={sl.shipDate ? formatShortDate(sl.shipDate) : "Not set"}
          />
          <Row
            label="Shipment"
            value={shipmentMethodToLabel(sl.shipmentMethod) || "—"}
          />
          <Row label="Freight acct" value={sl.freightAccount || "—"} />
        </WidgetCard>

        <WidgetCard
          title="Materials & specifications"
          icon={ClipboardList}
          onEdit={editsBlocked ? undefined : () => setShowMaterialsModal(true)}
        >
          <p className="text-xs font-medium text-slate-500">List of materials</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-600">
            {extras.materialsList?.trim() || scopeLinesToText(pd.scopeLines) || "No materials list."}
          </p>
          <p className="mt-3 text-xs font-medium text-slate-500">Additional notes</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
            {extras.additionalNotes?.trim() || "—"}
          </p>
        </WidgetCard>

        <JobFilesDocumentStrip
          variant="full"
          jobId={job.id}
          files={files}
          fileSort={fileSort}
          onFileSortChange={onFileSortChange}
          onUpload={editsBlocked ? undefined : onUploadFile}
          onDownload={onDownloadFile}
          onOpenFile={onOpenFile}
          onPreviewFile={onPreviewFile}
          onDownloadVersionFile={onDownloadVersionFile}
          onDeleted={onDeletedFile}
          onFailedFile={onFailedFile}
        />
      </section>

      <EditModal
        open={showLogisticsModal}
        title="Edit scheduling & logistics"
        onClose={() => setShowLogisticsModal(false)}
        wide
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div>
            <span className="block text-sm font-medium text-slate-700">
              Production status
            </span>
            <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {job.status || "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Follows the job&apos;s stage progress — change it from Status
              Control.
            </p>
          </div>
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
        onClose={() => !materialsBusy && setShowMaterialsModal(false)}
        wide
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {materialsError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {materialsError}
            </p>
          ) : null}
          <TextAreaField
            label="List of materials for this job"
            value={materialsDraft.materialsList}
            onChange={(v) => setMaterialsDraft((p) => ({ ...p, materialsList: v }))}
            rows={6}
          />
          <TextAreaField
            label="Additional notes"
            value={materialsDraft.additionalNotes}
            onChange={(v) => setMaterialsDraft((p) => ({ ...p, additionalNotes: v }))}
            rows={4}
          />
          <button
            className="btn-primary w-full"
            onClick={saveMaterials}
            disabled={isSaving || materialsBusy || !job.dbId}
          >
            {materialsBusy || isSaving ? "Saving…" : "Save materials"}
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
            className="rounded-lg border border-[#E5E7EB] p-1.5 text-slate-500 opacity-100 pointer-events-auto transition-opacity duration-150 hover:border-orange-200 focus:opacity-100 lg:opacity-0 lg:pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto lg:group-focus-within:opacity-100 lg:group-focus-within:pointer-events-auto"
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
