"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { useJobs } from "@/context/JobsContext";
import { ensurePrintDetails } from "@/lib/jobCardFormDefaults";
import { jobPriorities, resinTypes } from "@/lib/jobData";
import type { Job, JobPriority, JobStatus, ResinType } from "@/lib/types";
import {
  getAssignableWorkers,
  getWorkerById,
  resolveWorkerNameFromId,
} from "@/lib/workers";

const SHOW_TEAM_FIELDS = false;
const SHOW_ERP_EXTENDED_FIELDS = false;

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const STATUS_PILLS: { label: string; status: JobStatus }[] = [
  { label: "Not Started", status: "Pending" },
  { label: "Manufacturing", status: "In Fabrication" },
  { label: "Delivered", status: "Complete" },
  { label: "Approval", status: "Awaiting Manager Approval" },
  { label: "Ready", status: "Ready to Manufacture" },
];

type FormErrors = Partial<
  Record<
    | "jobId"
    | "clientName"
    | "projectName"
    | "dateReceived"
    | "contactEmail"
    | "status"
    | "qaCompleted"
    | "submit",
    string
  >
>;

const WIZARD_STEPS = [
  { id: "customer", label: "Customer" },
  { id: "project", label: "Project" },
  { id: "scope", label: "Scope" },
  { id: "assignment", label: "Assignment" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/**
 * Errors each step owns. Advancing is gated on the current step's fields only,
 * so a problem later in the form never blocks progress through earlier steps.
 */
const STEP_FIELDS: Record<WizardStepId, (keyof FormErrors)[]> = {
  customer: ["jobId", "clientName", "contactEmail"],
  project: ["projectName", "dateReceived"],
  scope: ["status", "qaCompleted"],
  assignment: [],
};

interface PendingFile {
  id: string;
  name: string;
  sizeLabel: string;
  file: File;
}

export interface CreateJobFormValues {
  jobId: string;
  clientName: string;
  clientContactName: string;
  contactPhone: string;
  contactEmail: string;
  projectName: string;
  description: string;
  resinType: ResinType;
  priority: JobPriority;
  dueDate: string;
  dateReceived: string;
  status: JobStatus;
  assignedWorkerId: string;
  estimatedHours: string;
  alert: string;
  /**
   * PRD "Needs Job Card" flag (§2.1). `false` marks a delivery-docket-only job.
   * Persisted to the existing `jobs.manufacturing_required` column until the
   * backend migration gives it a dedicated `needs_job_card` field.
   */
  needsJobCard: boolean;
  installRequired: boolean;
  qaCompleted: boolean;
  transportCompany: string;
  freightAccount: string;
  deliveryInstructions: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function suggestNextJobId(jobs: Job[]): string {
  let max = 1000;
  for (const job of jobs) {
    const match = /^JOB-(\d+)$/i.exec(job.id.trim());
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `JOB-${max + 1}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildInitialForm(jobs: Job[]): CreateJobFormValues {
  return {
    jobId: suggestNextJobId(jobs),
    clientName: "",
    clientContactName: "",
    contactPhone: "",
    contactEmail: "",
    projectName: "",
    description: "",
    resinType: resinTypes[0],
    priority: "Normal",
    dueDate: "",
    dateReceived: todayIsoDate(),
    status: "Pending",
    assignedWorkerId: "",
    estimatedHours: "",
    alert: "",
    needsJobCard: true,
    installRequired: false,
    qaCompleted: false,
    transportCompany: "",
    freightAccount: "",
    deliveryInstructions: "",
  };
}

function validateForm(
  values: CreateJobFormValues,
  existingIds: Set<string>
): FormErrors {
  const errors: FormErrors = {};
  const jobId = values.jobId.trim().toUpperCase();

  if (!jobId) {
    errors.jobId = "Job ID is required.";
  } else if (!/^JOB-[A-Z0-9-]+$/i.test(jobId)) {
    errors.jobId = "Use format JOB-10421.";
  } else if (existingIds.has(jobId)) {
    errors.jobId = "This job ID already exists.";
  }

  if (!values.clientName.trim()) {
    errors.clientName = "Customer name is required.";
  }
  if (!values.projectName.trim()) {
    errors.projectName = "Project name is required.";
  }
  if (!values.dateReceived.trim()) {
    errors.dateReceived = "Received date is required.";
  }

  const email = values.contactEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = "Enter a valid email address.";
  }

  // Conditional flag rules (PRD §2.1 — "validation for conditional flags").
  if (
    !values.needsJobCard &&
    (values.status === "Ready to Manufacture" || values.status === "In Fabrication")
  ) {
    errors.status =
      "Delivery-docket-only jobs cannot start in a manufacturing status.";
  }

  if (values.qaCompleted && values.needsJobCard) {
    errors.qaCompleted =
      "QA cannot already be complete on a job that still needs fabrication.";
  }

  return errors;
}

function buildJobFromForm(values: CreateJobFormValues): Job {
  const worker = getWorkerById(values.assignedWorkerId || null);
  const assignedWorkerName =
    worker?.display_name ?? resolveWorkerNameFromId(values.assignedWorkerId);

  const estimated =
    values.estimatedHours.trim() === ""
      ? null
      : Number.parseFloat(values.estimatedHours);

  const base: Job = {
    id: values.jobId.trim().toUpperCase(),
    clientName: values.clientName.trim(),
    projectName: values.projectName.trim(),
    date: values.dateReceived,
    dueDate: values.dueDate.trim() || null,
    quoteValidUntil: null,
    estimatedHours:
      estimated != null && !Number.isNaN(estimated) ? estimated : null,
    resinType: values.resinType,
    status: values.status,
    priority: values.priority,
    alert: values.alert.trim() || null,
    manufacturingRequired: values.needsJobCard,
    installRequired: values.installRequired,
    qaCompleted: values.qaCompleted,
    clientContactName: values.clientContactName.trim(),
    assignedWorkerId: values.assignedWorkerId || null,
    assignedWorkerName: assignedWorkerName || null,
    manualInstructions: values.description.trim(),
    printDetails: ensurePrintDetails({
      id: values.jobId,
      clientName: values.clientName,
      projectName: values.projectName,
      date: values.dateReceived,
      dueDate: values.dueDate || null,
      quoteValidUntil: null,
      estimatedHours: null,
      resinType: values.resinType,
      status: values.status,
      priority: values.priority,
      alert: null,
      manufacturingRequired: values.needsJobCard,
      installRequired: values.installRequired,
      qaCompleted: values.qaCompleted,
      clientContactName: values.clientContactName,
      assignedWorkerId: values.assignedWorkerId || null,
      manualInstructions: values.description,
      printDetails: {
        contactPhone: values.contactPhone.trim(),
        contactEmail: values.contactEmail.trim(),
        transportCompany: values.transportCompany.trim(),
        freightAccount: values.freightAccount.trim(),
        deliveryInstructions: values.deliveryInstructions.trim(),
      },
    }),
  };

  return {
    ...base,
    printDetails: ensurePrintDetails(base),
  };
}

interface CreateNewJobDrawerProps {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
}

export function CreateNewJobDrawer({
  open,
  onClose,
  jobs,
}: CreateNewJobDrawerProps) {
  const router = useRouter();
  const { createJobFromUi, refreshJobs } = useJobs();
  const [form, setForm] = useState<CreateJobFormValues>(() =>
    buildInitialForm(jobs)
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStep = WIZARD_STEPS[stepIndex];
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const existingIds = useMemo(
    () => new Set(jobs.map((j) => j.id.trim().toUpperCase())),
    [jobs]
  );

  const assignableWorkers = useMemo(() => getAssignableWorkers(), [open, jobs]);

  const resetForm = useCallback(() => {
    setForm(buildInitialForm(jobs));
    setErrors({});
    setPendingFiles([]);
    setIsSubmitting(false);
    setStepIndex(0);
  }, [jobs]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const patch = (patchValues: Partial<CreateJobFormValues>) => {
    setForm((prev) => ({ ...prev, ...patchValues }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patchValues) as (keyof FormErrors)[]) {
        if (key in next) delete next[key];
      }
      delete next.submit;
      return next;
    });
  };

  const handleFilesSelected = (list: FileList | null) => {
    if (!list?.length) return;
    const added: PendingFile[] = Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      sizeLabel: formatFileSize(file.size),
      file,
    }));
    setPendingFiles((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...added.filter((f) => !seen.has(f.id))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Errors belonging to a given step, so Next only gates on that step. */
  const errorsForStep = (all: FormErrors, step: WizardStepId): FormErrors => {
    const owned: FormErrors = {};
    for (const field of STEP_FIELDS[step]) {
      if (all[field]) owned[field] = all[field];
    }
    return owned;
  };

  const handleNext = () => {
    const all = validateForm(form, existingIds);
    const blocking = errorsForStep(all, currentStep.id);
    if (Object.keys(blocking).length > 0) {
      setErrors(blocking);
      return;
    }
    setErrors({});
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async () => {
    const nextErrors = validateForm(form, existingIds);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Surface the earliest step that still has a problem.
      const firstBadStep = WIZARD_STEPS.findIndex(
        (step) => Object.keys(errorsForStep(nextErrors, step.id)).length > 0
      );
      if (firstBadStep >= 0) setStepIndex(firstBadStep);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    try {
      const job = buildJobFromForm(form);
      const created = await createJobFromUi(job);
      await refreshJobs({ silent: true });
      onClose();
      router.push(`/jobs/${encodeURIComponent(created.id)}`);
    } catch (e) {
      setErrors({
        submit:
          e instanceof Error
            ? e.message
            : "Could not create job. It may need to be created from an accepted quote.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={stepIndex === 0 ? onClose : handleBack}
        disabled={isSubmitting}
        className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#BFDBFE] bg-white px-5 text-sm font-semibold text-[#2563EB] transition-colors hover:bg-[#EFF6FF] disabled:opacity-50"
      >
        {stepIndex === 0 ? "Cancel" : "Back"}
      </button>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">
          Step {stepIndex + 1} of {WIZARD_STEPS.length}
        </span>
        {isLastStep ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#2563EB] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {isSubmitting ? "Creating…" : "Create Job"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#2563EB] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );

  const stepIndicator = (
    <ol className="flex items-center gap-1.5" aria-label="Progress">
      {WIZARD_STEPS.map((step, index) => {
        const done = index < stepIndex;
        const active = index === stepIndex;
        return (
          <li key={step.id} className="flex flex-1 flex-col gap-1">
            <span
              aria-hidden
              className={`h-1 rounded-full transition-colors ${
                done || active ? "bg-[#2563EB]" : "bg-[#E2E8F0]"
              }`}
            />
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                active ? "text-[#2563EB]" : "text-slate-400"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <EnterpriseDrawer
      open={open}
      onClose={onClose}
      title="Create New Job"
      subtitle="Add fabrication project details"
      footer={footer}
      panelClassName="w-full md:w-[min(520px,100%)] md:max-w-[520px]"
      ariaLabelledBy="create-job-title"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        noValidate
      >
        {stepIndicator}

        {errors.submit && (
          <p
            className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {errors.submit}
          </p>
        )}

        {currentStep.id === "customer" && (
        <FormSection title="Basic Info">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Job ID" error={errors.jobId} className="sm:col-span-2">
              <input
                type="text"
                value={form.jobId}
                onChange={(e) => patch({ jobId: e.target.value })}
                className={`${inputClass} ${errors.jobId ? "border-red-300 ring-red-100" : ""}`}
                placeholder="JOB-10421"
                autoComplete="off"
              />
            </Field>
            <Field label="Customer Name" error={errors.clientName}>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => patch({ clientName: e.target.value })}
                className={`${inputClass} ${errors.clientName ? "border-red-300 ring-red-100" : ""}`}
              />
            </Field>
            <Field label="Contact Person">
              <input
                type="text"
                value={form.clientContactName}
                onChange={(e) => patch({ clientContactName: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Phone Number">
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => patch({ contactPhone: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Email" error={errors.contactEmail}>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => patch({ contactEmail: e.target.value })}
                className={`${inputClass} ${errors.contactEmail ? "border-red-300 ring-red-100" : ""}`}
              />
            </Field>
          </div>
        </FormSection>
        )}

        {currentStep.id === "project" && (
        <FormSection title="Project Details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project Name" error={errors.projectName} className="sm:col-span-2">
              <input
                type="text"
                value={form.projectName}
                onChange={(e) => patch({ projectName: e.target.value })}
                className={`${inputClass} ${errors.projectName ? "border-red-300 ring-red-100" : ""}`}
              />
            </Field>
            <Field label="Project Description" className="sm:col-span-2">
              <textarea
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={3}
                className={`${inputClass} min-h-[88px] resize-y`}
                placeholder="Scope, lay-up notes, site requirements…"
              />
            </Field>
            <Field label="Fabrication Type">
              <select
                value={form.resinType}
                onChange={(e) => patch({ resinType: e.target.value as ResinType })}
                className={inputClass}
              >
                {resinTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) => patch({ priority: e.target.value as JobPriority })}
                className={inputClass}
              >
                {jobPriorities.map((p) => (
                  <option key={p} value={p}>
                    {p === "RUSH" ? "Rush" : p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due Date">
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => patch({ dueDate: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Date Received" error={errors.dateReceived}>
              <input
                type="date"
                value={form.dateReceived}
                onChange={(e) => patch({ dateReceived: e.target.value })}
                className={`${inputClass} ${errors.dateReceived ? "border-red-300 ring-red-100" : ""}`}
              />
            </Field>
          </div>
        </FormSection>
        )}

        {currentStep.id === "scope" && (
        <FormSection title="Job Status">
          <div className="flex flex-wrap gap-2">
            {STATUS_PILLS.map((pill) => {
              const active = form.status === pill.status;
              return (
                <button
                  key={pill.status}
                  type="button"
                  onClick={() => patch({ status: pill.status })}
                  className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    active
                      ? "border-[#2563EB] bg-[#2563EB] text-white shadow-sm"
                      : "border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#BFDBFE] hover:bg-[#EFF6FF]"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
          {errors.status && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {errors.status}
            </p>
          )}

          <div className="mt-4 space-y-3 border-t border-[#E2E8F0] pt-4">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.needsJobCard}
                onChange={(e) => patch({ needsJobCard: e.target.checked })}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#0F172A]">
                  Needs Job Card
                </span>
                <span className="block text-xs text-slate-500">
                  Full custom manufacturing job. Turn off for simple
                  delivery-docket-only jobs.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.installRequired}
                onChange={(e) => patch({ installRequired: e.target.checked })}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#0F172A]">
                  Installation required
                </span>
                <span className="block text-xs text-slate-500">
                  Printed prominently on the job card.
                </span>
              </span>
            </label>

            <div>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.qaCompleted}
                  onChange={(e) => patch({ qaCompleted: e.target.checked })}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#0F172A]">
                    QA already complete
                  </span>
                  <span className="block text-xs text-slate-500">
                    Only for jobs recorded after the fact.
                  </span>
                </span>
              </label>
              {errors.qaCompleted && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {errors.qaCompleted}
                </p>
              )}
            </div>
          </div>
        </FormSection>
        )}

        {currentStep.id === "assignment" && (
        <>
        <FormSection title="Assignment">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Assigned Staff" className="sm:col-span-2">
              <select
                value={form.assignedWorkerId}
                onChange={(e) => patch({ assignedWorkerId: e.target.value })}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {assignableWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.display_name}
                  </option>
                ))}
              </select>
            </Field>
            {SHOW_TEAM_FIELDS && (
              <>
                <Field label="Team">
                  <input type="text" className={inputClass} disabled />
                </Field>
                <Field label="Supervisor">
                  <input type="text" className={inputClass} disabled />
                </Field>
              </>
            )}
          </div>
        </FormSection>

        <FormSection title="Files">
          <div
            className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#BFDBFE] bg-[#EFF6FF]/60 px-4 py-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
          >
            <Upload className="h-6 w-6 text-[#2563EB]" aria-hidden />
            <p className="mt-2 text-sm font-medium text-[#0F172A]">
              Drag & drop files here
            </p>
            <p className="mt-0.5 text-xs text-slate-500">PDF, images, or drawings</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex min-h-[34px] items-center rounded-full border border-[#E2E8F0] bg-white px-4 text-[11px] font-semibold uppercase tracking-wide text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              Browse files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
          {pendingFiles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {pendingFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0F172A]">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-slate-500">{file.sizeLabel}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E2E8F0] text-slate-500 hover:bg-[#F8FAFC]"
                      aria-label={`Download ${file.name}`}
                      onClick={() => {
                        const url = URL.createObjectURL(file.file);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = file.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E2E8F0] text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setPendingFiles((prev) => prev.filter((p) => p.id !== file.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 hidden text-[11px] text-slate-500">
            Files are staged locally until the job record exists in the system.
          </p>
        </FormSection>

        <details className={SHOW_ERP_EXTENDED_FIELDS ? "rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm" : "hidden"}>
          <summary className="cursor-pointer text-sm font-semibold text-[#0F172A]">
            Advanced ERP fields
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Estimated Hours">
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.estimatedHours}
                onChange={(e) => patch({ estimatedHours: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Priority Alert">
              <input
                type="text"
                value={form.alert}
                onChange={(e) => patch({ alert: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Transport Company" className="sm:col-span-2">
              <input
                type="text"
                value={form.transportCompany}
                onChange={(e) => patch({ transportCompany: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Freight Account" className="sm:col-span-2">
              <input
                type="text"
                value={form.freightAccount}
                onChange={(e) => patch({ freightAccount: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Delivery Instructions" className="sm:col-span-2">
              <textarea
                value={form.deliveryInstructions}
                onChange={(e) => patch({ deliveryInstructions: e.target.value })}
                rows={2}
                className={`${inputClass} min-h-[72px] resize-y`}
              />
            </Field>
          </div>
        </details>
        </>
        )}
      </form>
    </EnterpriseDrawer>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
