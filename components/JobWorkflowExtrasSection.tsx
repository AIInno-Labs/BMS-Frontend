"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  FileText,
  ListChecks,
  Pencil,
  Truck,
  X,
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
import {
  stageKeysForRequirements,
} from "@/lib/jobTimelineAnalytics";
import {
  applyJobStageSelection,
  markJobReady,
  setJobRequirement,
  saveJobMeasurements,
} from "@/lib/frp/api";
import { isCancelledJob } from "@/lib/frp/job-status";
import { isJobLockedForCashPayment } from "@/lib/frp/job-cash-payment-gate";
import {
  PROJECT_REQUIREMENT_LABELS,
  STAGE_PATH_REQUIREMENTS,
  type ProjectRequirementKind,
} from "@/lib/frp/project-requirements";
import { userIdToBackend, type JobUpdateAuditAction } from "@/lib/frp/job-mapper";
import type {
  Job,
  JobCardPrintDetails,
  JobProjectRequirement,
  JobSchedulingLogistics,
  JobWorkflowExtras,
  ProjectStageRequirements,
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
  /**
   * Called after Project Requirements are saved, because saving them reapplies
   * which stages the job has. Lets the parent refresh the cards that read the
   * stage tree - their own watch on job.status cannot see a change that leaves
   * the status alone.
   */
  onStagesChanged?: () => void;
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

/**
 * The 9 "which path does this job take" checkboxes, in the exact order the
 * client specced them (see `selectedTimelineStageIds` for what each one
 * actually does to the timeline).
 */
const STAGE_FLAG_ITEMS: {
  key: keyof ProjectStageRequirements;
  label: string;
}[] = [
  { key: "supplyOnly", label: "Supply only" },
  {
    key: "orderFromSupplierSupplyOnly",
    label: "Order from Supplier – Supply Only",
  },
  {
    key: "orderFromSupplierFabrication",
    label: "Order from Supplier – Fabrication",
  },
  { key: "project", label: "Project" },
  { key: "orderPartsExternal", label: "Order Parts (External)" },
  { key: "warranty", label: "Warranty" },
  { key: "siteVisitMeasure", label: "Site Visit / Measure" },
  { key: "installation", label: "Installation" },
];

/** The 4 real (backend) requirements, reordered to slot in after the 9 above. */
const REQUIREMENT_DISPLAY_ORDER: ProjectRequirementKind[] = [
  "CASH_PAYMENT_REQUIRED",
  "SAMPLE_REQUIRED",
  "DOCUMENTS_REQUIRED",
  "IGNORE_OVERDUE",
];

function buildRequirementsDraft(
  requirements: JobProjectRequirement[]
): Record<ProjectRequirementKind, boolean> {
  const draft = {} as Record<ProjectRequirementKind, boolean>;
  for (const kind of REQUIREMENT_DISPLAY_ORDER) {
    draft[kind] = requirements.find((r) => r.kind === kind)?.isRequired === true;
  }
  return draft;
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
  onStagesChanged,
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

  // Draft state for the whole Project Requirements card — nothing saves
  // until the button at the bottom is clicked, which is also what decides
  // whether that button is active or dulled out (see `requirementsDirty`).
  const [draftFlags, setDraftFlags] = useState<ProjectStageRequirements>(
    extras.projectStageRequirements ?? {}
  );
  const [draftRequirements, setDraftRequirements] = useState<
    Record<ProjectRequirementKind, boolean>
  >(() => buildRequirementsDraft(requirements));
  const [requirementsSaveBusy, setRequirementsSaveBusy] = useState(false);
  const [requirementsSaveError, setRequirementsSaveError] = useState<
    string | null
  >(null);

  useEffect(() => {
    setDraftFlags(extras.projectStageRequirements ?? {});
    setDraftRequirements(buildRequirementsDraft(requirements));
    // extras/requirements are both derived from job — job alone is the real
    // trigger for "the saved state changed under us, resync the draft".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  const savedFlags = extras.projectStageRequirements ?? {};
  const flagsDirty = STAGE_FLAG_ITEMS.some(
    ({ key }) => Boolean(draftFlags[key]) !== Boolean(savedFlags[key])
  );
  const requirementsDirty = REQUIREMENT_DISPLAY_ORDER.some(
    (kind) =>
      draftRequirements[kind] !==
      (requirements.find((r) => r.kind === kind)?.isRequired === true)
  );
  const projectRequirementsDirty = flagsDirty || requirementsDirty;

  const saveProjectRequirements = async () => {
    if (!job.dbId) return;
    setRequirementsSaveBusy(true);
    setRequirementsSaveError(null);
    try {
      const changedKinds = REQUIREMENT_DISPLAY_ORDER.filter(
        (kind) =>
          draftRequirements[kind] !==
          (requirements.find((r) => r.kind === kind)?.isRequired === true)
      );
      for (const kind of changedKinds) {
        await setJobRequirement(job.dbId, kind, draftRequirements[kind]);
      }

      // The path flags are requirements too, not just job-card keys, so they
      // are written as rows and can be reported on. Only the changed ones, to
      // keep this to the handful of writes a tick or two implies.
      const savedFlags = extras.projectStageRequirements ?? {};
      for (const { kind, flag } of STAGE_PATH_REQUIREMENTS) {
        const next = draftFlags[flag as keyof ProjectStageRequirements] === true;
        if (next === (savedFlags[flag as keyof ProjectStageRequirements] === true)) {
          continue;
        }
        await setJobRequirement(job.dbId, kind, next);
      }

      // And the server is told which stages this path implies, so it stops
      // emailing, counting and waiting on the ones that no longer apply.
      // Before the extras are saved: if this fails, the page must not be left
      // showing a selection the job does not have.
      await applyJobStageSelection(
        job.dbId,
        stageKeysForRequirements({
          ...job,
          printDetails: {
            ...pd,
            workflowExtras: {
              ...extras,
              projectStageRequirements: { ...draftFlags, confirmed: true },
              stageSelectionSource: "requirements",
            },
          },
        })
      );
      // Saving the setup counts as Mark Ready. The server only flips isReady
      // through this call, so it is made here once the stages are applied.
      if (job.isReady !== true) {
        await markJobReady(job.dbId);
      }

      await onSavePatch({
        printDetails: {
          ...pd,
          workflowExtras: {
            ...extras,
            projectStageRequirements: { ...draftFlags, confirmed: true },
            // Saving here is now the one action that makes Project
            // Requirements authoritative for the timeline — even if "Job
            // Stage Setting" was used more recently, this takes over.
            stageSelectionSource: "requirements",
          },
        },
      });
      // Always, not only when a requirement row changed: the stage selection
      // was just reapplied, so Status Control and Document Versions are
      // showing a tree that may no longer be the job's.
      onStagesChanged?.();
      await onJobChanged?.();
    } catch (e) {
      setRequirementsSaveError(
        e instanceof Error ? e.message : "Could not save project requirements"
      );
    } finally {
      setRequirementsSaveBusy(false);
    }
  };

  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
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

  useEffect(() => {
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

  return (
    <>
      <div className="mt-4 space-y-4">
        <WidgetCard title="Project Requirements" icon={ListChecks}>
          {job.requirementsConfirmedAt == null && (
            <span className="mb-2 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              Select project requirements
            </span>
          )}
          {requirementsSaveError ? (
            <p className="mb-2 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <span>{requirementsSaveError}</span>
              <button
                type="button"
                onClick={() => setRequirementsSaveError(null)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STAGE_FLAG_ITEMS.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={draftFlags[key] === true}
                  onChange={(e) =>
                    setDraftFlags((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  disabled={
                    isSaving || requirementsSaveBusy || cancelled || !job.dbId
                  }
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600"
                />
                {label}
              </label>
            ))}
            {REQUIREMENT_DISPLAY_ORDER.map((kind) => {
              const row = requirements.find(
                (r: JobProjectRequirement) => r.kind === kind
              );
              return (
                <label
                  key={kind}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={draftRequirements[kind] === true}
                    onChange={(e) =>
                      setDraftRequirements((prev) => ({
                        ...prev,
                        [kind]: e.target.checked,
                      }))
                    }
                    disabled={
                      isSaving || requirementsSaveBusy || cancelled || !job.dbId
                    }
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600"
                  />
                  {row?.label || PROJECT_REQUIREMENT_LABELS[kind]}
                </label>
              );
            })}
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
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className={`inline-flex items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:cursor-not-allowed ${
                projectRequirementsDirty
                  ? "bg-[#F97316] text-white hover:bg-[#EA580C]"
                  : "bg-slate-200 text-slate-400"
              }`}
              onClick={() => void saveProjectRequirements()}
              disabled={
                !projectRequirementsDirty ||
                isSaving ||
                requirementsSaveBusy ||
                cancelled ||
                !job.dbId
              }
            >
              {requirementsSaveBusy ? "Saving…" : "Save"}
            </button>
          </div>
        </WidgetCard>

        <section className="grid gap-4 lg:grid-cols-2">
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

          <SpecificationsCard
            job={job}
            pd={pd}
            isSaving={isSaving}
            editsBlocked={editsBlocked}
            onJobChanged={onJobChanged}
          />
        </section>

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
      </div>

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
    </>
  );
}

/**
 * "Specifications" card — extracted to its own component (rather than living
 * inline in the parent) so `JobWorkflowDashboard` can place it in the
 * Customer/Job Details row instead of here, without threading its edit-modal
 * state back up through `JobWorkflowExtrasSection`'s props.
 */
export function SpecificationsCard({
  job,
  pd,
  isSaving,
  editsBlocked,
  onJobChanged,
}: {
  job: Job;
  pd: JobCardPrintDetails;
  isSaving: boolean;
  editsBlocked: boolean;
  onJobChanged?: () => void | Promise<void>;
}) {
  const extras = ensureWorkflowExtras(pd.workflowExtras, job);
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    materialsList: extras.materialsList ?? "",
    additionalNotes: extras.additionalNotes ?? "",
  });

  useEffect(() => {
    const x = ensureWorkflowExtras(pd.workflowExtras, job);
    setDraft({
      materialsList: x.materialsList ?? "",
      additionalNotes: x.additionalNotes ?? "",
    });
  }, [job, pd]);

  const save = () => {
    if (!job.dbId) return;
    setBusy(true);
    setError(null);
    void saveJobMeasurements(job.dbId, {
      materials: { materialsList: draft.materialsList },
      notes: draft.additionalNotes,
    })
      .then(async () => {
        await onJobChanged?.();
        setShowModal(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not save materials");
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <WidgetCard
        title="Specifications"
        icon={ClipboardList}
        onEdit={editsBlocked ? undefined : () => setShowModal(true)}
      >
        <p className="text-xs font-medium text-slate-500">List of specifications</p>
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-600">
          {extras.materialsList?.trim() ||
            scopeLinesToText(pd.scopeLines) ||
            "No specifications list."}
        </p>
        <p className="mt-3 text-xs font-medium text-slate-500">Additional notes</p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">
          {extras.additionalNotes?.trim() || "—"}
        </p>
      </WidgetCard>

      <EditModal
        open={showModal}
        title="Edit specifications"
        onClose={() => !busy && setShowModal(false)}
        wide
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <TextAreaField
            label="List of specifications for this job"
            value={draft.materialsList}
            onChange={(v) => setDraft((p) => ({ ...p, materialsList: v }))}
            rows={6}
          />
          <TextAreaField
            label="Additional notes"
            value={draft.additionalNotes}
            onChange={(v) => setDraft((p) => ({ ...p, additionalNotes: v }))}
            rows={4}
          />
          <button
            className="btn-primary w-full"
            onClick={save}
            disabled={isSaving || busy || !job.dbId}
          >
            {busy || isSaving ? "Saving…" : "Save materials"}
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
