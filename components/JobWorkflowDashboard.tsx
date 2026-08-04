"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheckBig,
  CircleDollarSign,
  MessageSquare,
  ClipboardList,
  Download,
  Loader2,
  History,
  Mail,
  Package,
  Pencil,
  Phone,
  Plus,
  Settings,
  StickyNote,
  User,
} from "lucide-react";
import { ActivityAuditTrail } from "@/components/ActivityAuditTrail";
import { JobNotesChatDrawer } from "@/components/JobNotesChatDrawer";
import { RaisedBySelect } from "@/components/RaisedBySelect";
import { JobTimelineAnalytics } from "@/components/JobTimelineAnalytics";
import { JobWorkflowExtrasSection } from "@/components/JobWorkflowExtrasSection";
import { ensurePrintDetails } from "@/lib/jobCardFormDefaults";
import {
  DEFAULT_REQUIRED_INVENTORY,
  ensureWorkflowExtras,
  JOB_TYPE_OPTIONS,
} from "@/lib/jobWorkflowExtras";
import {
  normalizeJobFiles,
  sortJobFiles,
  type JobFileRecord,
  type JobFileSortMode,
} from "@/lib/jobFilesSort";
import { formatCreatedDate, formatShortDate, jobPriorities } from "@/lib/mockData";
import type { JobUpdateAuditAction } from "@/lib/frp/job-mapper";
import type { Job, JobPriority, JobWorkflowExtras, RequiredInventoryItem } from "@/lib/types";
import {
  getAssignableWorkers,
  getWorkerDisplayName,
  resolveWorkerNameFromId,
} from "@/lib/workers";

interface JobWorkflowDashboardProps {
  job: Job;
  isSaving: boolean;
  isExporting?: boolean;
  saveError: string | null;
  saveSuccess?: boolean;
  auditRefreshKey?: number;
  onPrint: () => void;
  onSavePatch: (
    patch: Partial<Job>,
    options?: { audit?: JobUpdateAuditAction; auditDetail?: string | null }
  ) => Promise<void>;
}

const DRAWING_CHECKLIST = [
  { key: "measurements", label: "Measurements taken" },
  { key: "drawingCreated", label: "Drawing created" },
  { key: "clientApproved", label: "Client approved" },
  { key: "engineerApproved", label: "Engineer approved" },
  { key: "revAIssued", label: "Rev A issued" },
] as const;

type DrawingCheckKey = (typeof DRAWING_CHECKLIST)[number]["key"];

type DrawingCheckState = Record<DrawingCheckKey, boolean>;

const DEFAULT_DRAWING: DrawingCheckState = {
  measurements: false,
  drawingCreated: false,
  clientApproved: false,
  engineerApproved: false,
  revAIssued: false,
};

type JobFile = JobFileRecord;

function loadDrawingChecklist(jobId: string): DrawingCheckState {
  const raw = window.localStorage.getItem(`frp-drawing-${jobId}`);
  if (!raw) return { ...DEFAULT_DRAWING };
  try {
    return { ...DEFAULT_DRAWING, ...(JSON.parse(raw) as DrawingCheckState) };
  } catch {
    return { ...DEFAULT_DRAWING };
  }
}

function defaultDemoFiles(job: Job): JobFile[] {
  const pd = ensurePrintDetails(job);
  const files: JobFile[] = [
    {
      name: "Job specification.pdf",
      category: "Specification",
      time: "Attached",
      uploadedAt: Date.now() - 2 * 86_400_000,
    },
    {
      name: "Assembly drawing rev-A.pdf",
      category: "Drawing",
      time: "3d ago",
      uploadedAt: Date.now() - 3 * 86_400_000,
    },
    {
      name: "Client approval sign-off.pdf",
      category: "Approval",
      time: "1w ago",
      uploadedAt: Date.now() - 7 * 86_400_000,
    },
  ];

  if (pd.purchaseOrderNo) {
    files.unshift({
      name: `PO-${pd.purchaseOrderNo}.pdf`,
      category: "Purchase Order",
      time: "Attached",
      uploadedAt: Date.now() - 4 * 86_400_000,
    });
  }

  return files;
}

function loadFiles(job: Job): JobFile[] {
  const defaults = defaultDemoFiles(job);
  const defaultNames = new Set(defaults.map((file) => file.name));
  const raw = window.localStorage.getItem(`frp-files-${job.id}`);

  if (!raw) return normalizeJobFiles(defaults);

  try {
    const parsed = JSON.parse(raw) as JobFile[];
    if (!Array.isArray(parsed) || !parsed.length) return normalizeJobFiles(defaults);

    const extras = parsed.filter((file) => !defaultNames.has(file.name));
    return normalizeJobFiles([...defaults, ...extras]);
  } catch {
    return normalizeJobFiles(defaults);
  }
}

function downloadDemoFile(fileName: string) {
  const blob = new Blob([`Demo export placeholder for ${fileName}`], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function JobWorkflowDashboard({
  job,
  isSaving,
  isExporting = false,
  saveError,
  saveSuccess,
  auditRefreshKey = 0,
  onPrint,
  onSavePatch,
}: JobWorkflowDashboardProps) {
  const pd = ensurePrintDetails(job);
  const extras = ensureWorkflowExtras(pd.workflowExtras, job);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [fileSort, setFileSort] = useState<JobFileSortMode>("recents");
  const [drawingChecklist, setDrawingChecklist] = useState<DrawingCheckState>(DEFAULT_DRAWING);
  const [fileUploadDraft, setFileUploadDraft] = useState({
    fileName: "",
    category: "Specification",
  });
  const [customerDraft, setCustomerDraft] = useState({
    clientName: job.clientName,
    clientContactName: job.clientContactName ?? "",
    contactPhone: pd.contactPhone ?? "",
    contactEmail: pd.contactEmail ?? "",
  });
  const [jobDraft, setJobDraft] = useState({
    projectName: job.projectName,
    status: job.status,
    dueDate: job.dueDate ?? "",
    priority: job.priority,
    manualInstructions: job.manualInstructions ?? "",
    assignedWorkerId: job.assignedWorkerId ?? "",
    raisedBy: pd.raisedBy ?? "",
    jobType: extras.jobType ?? JOB_TYPE_OPTIONS[0],
    projectedStartDate: extras.projectedStartDate ?? "",
  });
  const [inventoryDraft, setInventoryDraft] = useState<RequiredInventoryItem[]>(
    () => extras.requiredInventory ?? DEFAULT_REQUIRED_INVENTORY
  );
  const [jobCardNotesDraft, setJobCardNotesDraft] = useState(extras.jobCardNotes ?? "");

  const assignableWorkers = getAssignableWorkers();

  useEffect(() => {
    setFiles(loadFiles(job));
    setDrawingChecklist(loadDrawingChecklist(job.id));
    const savedSort = window.localStorage.getItem(`frp-files-sort-${job.id}`);
    if (
      savedSort === "recents" ||
      savedSort === "newest" ||
      savedSort === "name" ||
      savedSort === "category"
    ) {
      setFileSort(savedSort);
    }
    const raw = window.localStorage.getItem(`frp-notes-${job.id}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) setNotes(parsed);
      } catch {
        // Ignore malformed demo cache.
      }
    }
  }, [job.id]);

  useEffect(() => {
    window.localStorage.setItem(`frp-notes-${job.id}`, JSON.stringify(notes));
  }, [job.id, notes]);

  useEffect(() => {
    window.localStorage.setItem(`frp-files-${job.id}`, JSON.stringify(files));
  }, [job.id, files]);

  useEffect(() => {
    window.localStorage.setItem(`frp-files-sort-${job.id}`, fileSort);
  }, [job.id, fileSort]);

  useEffect(() => {
    window.localStorage.setItem(
      `frp-drawing-${job.id}`,
      JSON.stringify(drawingChecklist)
    );
  }, [job.id, drawingChecklist]);

  useEffect(() => {
    const nextPd = ensurePrintDetails(job);
    setCustomerDraft({
      clientName: job.clientName,
      clientContactName: job.clientContactName ?? "",
      contactPhone: nextPd.contactPhone ?? "",
      contactEmail: nextPd.contactEmail ?? "",
    });
    const nextExtras = ensureWorkflowExtras(nextPd.workflowExtras, job);
    setJobDraft({
      projectName: job.projectName,
      status: job.status,
      dueDate: job.dueDate ?? "",
      priority: job.priority,
      manualInstructions: job.manualInstructions ?? "",
      assignedWorkerId: job.assignedWorkerId ?? "",
      raisedBy: nextPd.raisedBy ?? "",
      jobType: nextExtras.jobType ?? JOB_TYPE_OPTIONS[0],
      projectedStartDate: nextExtras.projectedStartDate ?? "",
    });
    setInventoryDraft(
      nextExtras.requiredInventory ?? DEFAULT_REQUIRED_INVENTORY
    );
    setJobCardNotesDraft(nextExtras.jobCardNotes ?? "");
  }, [job]);

  const drawingDoneCount = useMemo(
    () => DRAWING_CHECKLIST.filter((item) => drawingChecklist[item.key]).length,
    [drawingChecklist]
  );

  const sortedFiles = useMemo(
    () => sortJobFiles(files, fileSort),
    [files, fileSort]
  );

  const systemNote = job.createdAt
    ? `Job created and added to the fabrication queue · ${formatCreatedDate(job.createdAt)}`
    : "Job created and added to the fabrication queue";

  const handleDrawingToggle = (key: DrawingCheckKey, checked: boolean) => {
    const next = { ...drawingChecklist, [key]: checked };
    setDrawingChecklist(next);

    const done = DRAWING_CHECKLIST.filter((item) => next[item.key]).length;
    if (done >= 5) {
      void onSavePatch({ status: "Ready to Manufacture" });
      return;
    }
    if (next.engineerApproved && next.clientApproved) {
      void onSavePatch({ status: "Awaiting Manager Approval" });
    }
  };

  const assignedLabel =
    job.assignedWorkerName || getWorkerDisplayName(job.assignedWorkerId);

  const postNote = () => {
    if (!noteDraft.trim()) return;
    setNotes((prev) =>
      [`${new Date().toLocaleTimeString()} ${noteDraft.trim()}`, ...prev].slice(0, 24)
    );
    setNoteDraft("");
  };

  const savePaymentExtras = (
    nextExtras: JobWorkflowExtras,
    auditDetail: string
  ) => {
    void onSavePatch(
      {
        printDetails: {
          ...pd,
          workflowExtras: nextExtras,
        },
      },
      { audit: "payment_updated", auditDetail }
    );
  };

  const handlePaymentReceivedChange = (value: boolean) => {
    savePaymentExtras(
      { ...extras, paymentReceived: value },
      `Payment received: ${value ? "Yes" : "No"}`
    );
  };

  const handlePaymentDueDateChange = (date: string) => {
    savePaymentExtras(
      { ...extras, paymentDueDate: date },
      date
        ? `Estimated payment due date: ${formatShortDate(date)}`
        : "Estimated payment due date cleared"
    );
  };

  const jobCardNotesDirty = jobCardNotesDraft !== (extras.jobCardNotes ?? "");

  const saveJobCardNotes = () => {
    if (!jobCardNotesDirty) return;
    void onSavePatch({
      printDetails: {
        ...pd,
        workflowExtras: {
          ...extras,
          jobCardNotes: jobCardNotesDraft,
        },
      },
    });
  };

  return (
    <div className="no-print mx-auto w-full max-w-[88rem] px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/jobs"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#374151] shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50/50 hover:text-[#111827]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to Jobs
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onPrint}
            disabled={isExporting}
            aria-busy={isExporting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F97316] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#EA580C] disabled:cursor-wait disabled:opacity-80"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            {isExporting ? "Exporting…" : "Export PDF"}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50"
            onClick={() => {
              if (
                !window.confirm(
                  `Mark job ${job.id} as cancelled? This updates workflow status only.`
                )
              ) {
                return;
              }
              void onSavePatch({ status: "Cancelled" });
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <JobTimelineAnalytics job={job} drawingDoneCount={drawingDoneCount} />

      {!chatDrawerOpen && (
        <button
          type="button"
          onClick={() => setChatDrawerOpen(true)}
          className="fixed right-0 top-[42%] z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl border border-r-0 border-[#E5E7EB] bg-white px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#111827] shadow-[-4px_0_16px_rgba(15,23,42,0.08)] transition-colors hover:border-orange-200 hover:bg-orange-50/80 print:hidden"
          aria-label="Open chat"
        >
          <MessageSquare className="h-4 w-4 text-[#F97316]" aria-hidden />
          <span className="flex flex-col items-center gap-0.5 text-[11px] font-bold leading-none text-[#111827]">
            <span>C</span>
            <span>H</span>
            <span>A</span>
            <span>T</span>
          </span>
        </button>
      )}

      <JobNotesChatDrawer
        open={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
        jobId={job.id}
        systemNote={systemNote}
        notes={notes}
        noteDraft={noteDraft}
        onNoteDraftChange={setNoteDraft}
        onPostNote={postNote}
      />

      <JobWorkflowExtrasSection
        job={job}
        pd={pd}
        isSaving={isSaving}
        onSavePatch={onSavePatch}
        files={sortedFiles}
        fileSort={fileSort}
        onFileSortChange={setFileSort}
        onUploadFile={() => setShowFileModal(true)}
        onDownloadFile={downloadDemoFile}
      />

      <div className="mt-4 space-y-4">
      <section className="grid gap-4 lg:grid-cols-3">
        <WidgetCard title="Customer Details" icon={User} onEdit={() => setShowCustomerModal(true)}>
          <CustomerRow icon={User} label="Contact" value={job.clientContactName || "—"} />
          <CustomerRow icon={Phone} label="Phone" value={pd.contactPhone?.trim() || "—"} />
          <CustomerRow icon={Mail} label="Email" value={pd.contactEmail?.trim() || "—"} />
        </WidgetCard>

        <WidgetCard title="Job Details" icon={Settings} onEdit={() => setShowJobModal(true)}>
          <p className="font-medium text-slate-800">{job.projectName}</p>
          <p className="text-sm text-slate-600">
            Assigned: {assignedLabel === "Unassigned" ? "Unassigned" : assignedLabel}
          </p>
          <p className="text-sm text-slate-600">
            {job.manualInstructions?.trim() || "No description provided."}
          </p>
          <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            {job.priority}
          </span>
          <p className="text-sm text-slate-500">
            Type: {extras.jobType} · Stage: {job.status}
          </p>
          <p className="text-sm text-slate-500">
            Due: {job.dueDate ? formatShortDate(job.dueDate) : "Not set"}
            {extras.projectedStartDate
              ? ` · Start: ${formatShortDate(extras.projectedStartDate)}`
              : ""}
          </p>
          <p className="text-sm text-slate-500">Raised by: {pd.raisedBy ?? "—"}</p>
        </WidgetCard>

        <WidgetCard title="Drawing" icon={ClipboardList}>
          <div className="space-y-2">
            {DRAWING_CHECKLIST.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm hover:border-orange-200"
              >
                <input
                  type="checkbox"
                  checked={drawingChecklist[item.key]}
                  onChange={(e) => handleDrawingToggle(item.key, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                />
                {item.label}
              </label>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Manufacturing" icon={CircleCheckBig}>
          <label className="mt-2 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={job.status === "In Fabrication" || job.status === "Ready to Manufacture"}
              onChange={(e) =>
                void onSavePatch({
                  status: e.target.checked ? "In Fabrication" : "Pending",
                })
              }
              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
            />
            Ready to Manufacture
          </label>
        </WidgetCard>

        <WidgetCard title="Inventory" icon={Package} onEdit={() => setShowInventoryModal(true)}>
          <div className="space-y-1.5">
            {inventoryDraft.map((item) => (
              <p key={item.label} className="text-sm text-slate-700">
                {item.label} · Qty {item.qty}
              </p>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Payment Status" icon={CircleDollarSign}>
          <fieldset className="mt-2 space-y-2">
            <legend className="text-sm text-slate-700">Payment received</legend>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`payment-received-${job.id}`}
                  checked={extras.paymentReceived === true}
                  onChange={() => handlePaymentReceivedChange(true)}
                  className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-300"
                />
                Yes
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`payment-received-${job.id}`}
                  checked={extras.paymentReceived === false}
                  onChange={() => handlePaymentReceivedChange(false)}
                  className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-300"
                />
                No
              </label>
            </div>
          </fieldset>
          <label className="mt-3 block text-sm text-slate-700">
            <span className="mb-1 block">Estimated due date for payment</span>
            <input
              type="date"
              value={extras.paymentDueDate ?? ""}
              onChange={(e) => handlePaymentDueDateChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#111827] outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
            />
          </label>
        </WidgetCard>

      </section>

      <section className="app-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <StickyNote className="h-4 w-4 text-[#F97316]" aria-hidden />
            Job Card Notes
          </p>
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={saveJobCardNotes}
            disabled={isSaving || !jobCardNotesDirty}
          >
            {isSaving ? "Saving…" : "Save notes"}
          </button>
        </div>
        <textarea
          value={jobCardNotesDraft}
          onChange={(e) => setJobCardNotesDraft(e.target.value)}
          rows={5}
          placeholder="Add notes for this job card…"
          className="mt-3 min-h-[8rem] w-full resize-y rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-3 py-2.5 text-sm leading-relaxed text-[#111827] outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:bg-white focus:ring-2 focus:ring-orange-200/40"
        />
      </section>

      <section>
        <div className="app-card overflow-hidden p-0">
          <div className="border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <History className="h-4 w-4 text-[#F97316]" />
              Audit History
            </p>
            <p className="text-xs text-slate-500">Recent actions and system events</p>
          </div>
          <div className="[&_section]:border-0 [&_section]:shadow-none [&_section]:rounded-none">
            <ActivityAuditTrail
              jobId={job.dbId ?? ""}
              refreshKey={auditRefreshKey}
            />
          </div>
        </div>
      </section>

      {(saveError || saveSuccess) && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${saveError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          {saveError || "Saved. PDF export reflects updated fields."}
        </p>
      )}
      </div>

      <EditModal
        open={showCustomerModal}
        title="Edit Customer Details"
        onClose={() => setShowCustomerModal(false)}
      >
        <div className="space-y-3">
          <ModalField label="Company Name" value={customerDraft.clientName} onChange={(v) => setCustomerDraft((p) => ({ ...p, clientName: v }))} />
          <ModalField label="Contact Name" value={customerDraft.clientContactName} onChange={(v) => setCustomerDraft((p) => ({ ...p, clientContactName: v }))} />
          <ModalField label="Phone" value={customerDraft.contactPhone} onChange={(v) => setCustomerDraft((p) => ({ ...p, contactPhone: v }))} />
          <ModalField label="Email" value={customerDraft.contactEmail} onChange={(v) => setCustomerDraft((p) => ({ ...p, contactEmail: v }))} />
          <button
            className="btn-primary w-full"
            onClick={() =>
              void onSavePatch({
                clientName: customerDraft.clientName.trim() || job.clientName,
                clientContactName: customerDraft.clientContactName.trim(),
                printDetails: {
                  ...ensurePrintDetails(job),
                  contactPhone: customerDraft.contactPhone.trim(),
                  contactEmail: customerDraft.contactEmail.trim(),
                },
              }).then(() => setShowCustomerModal(false))
            }
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </EditModal>

      <EditModal open={showJobModal} title="Edit Job Details" onClose={() => setShowJobModal(false)}>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <ModalField label="Project Name" value={jobDraft.projectName} onChange={(v) => setJobDraft((p) => ({ ...p, projectName: v }))} />
          <label className="block text-sm font-medium text-slate-700">
            Assigned Staff
            <select
              value={jobDraft.assignedWorkerId}
              onChange={(e) => setJobDraft((p) => ({ ...p, assignedWorkerId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {assignableWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              value={jobDraft.manualInstructions}
              onChange={(e) => setJobDraft((p) => ({ ...p, manualInstructions: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Priority
            <select
              value={jobDraft.priority}
              onChange={(e) => setJobDraft((p) => ({ ...p, priority: e.target.value as JobPriority }))}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              {jobPriorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Raised by
            <RaisedBySelect
              variant="compact"
              value={jobDraft.raisedBy}
              onChange={(name) => setJobDraft((p) => ({ ...p, raisedBy: name }))}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Job type
            <select
              value={jobDraft.jobType}
              onChange={(e) => setJobDraft((p) => ({ ...p, jobType: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              {JOB_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Projected start date
            <input
              type="date"
              value={jobDraft.projectedStartDate}
              onChange={(e) =>
                setJobDraft((p) => ({ ...p, projectedStartDate: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Stage / status
            <select
              value={jobDraft.status}
              onChange={(e) => setJobDraft((p) => ({ ...p, status: e.target.value as Job["status"] }))}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="Pending">Pending</option>
              <option value="Awaiting Manager Approval">Awaiting Manager Approval</option>
              <option value="Ready to Manufacture">Ready to Manufacture</option>
              <option value="In Fabrication">In Fabrication</option>
              <option value="Complete">Complete</option>
              <option value="On Hold">On Hold</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Due Date
            <input
              type="date"
              value={jobDraft.dueDate}
              onChange={(e) => setJobDraft((p) => ({ ...p, dueDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            className="btn-primary w-full"
            onClick={() => {
              const workerId = jobDraft.assignedWorkerId || null;
              void onSavePatch({
                projectName: jobDraft.projectName.trim() || job.projectName,
                status: jobDraft.status,
                dueDate: jobDraft.dueDate.trim() || null,
                priority: jobDraft.priority,
                manualInstructions: jobDraft.manualInstructions,
                assignedWorkerId: workerId,
                assignedWorkerName: resolveWorkerNameFromId(workerId),
                printDetails: {
                  ...ensurePrintDetails(job),
                  raisedBy: jobDraft.raisedBy,
                  workflowExtras: {
                    ...ensureWorkflowExtras(pd.workflowExtras, job),
                    jobType: jobDraft.jobType,
                    projectedStartDate: jobDraft.projectedStartDate,
                  },
                },
              }).then(() => setShowJobModal(false));
            }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </EditModal>

      <EditModal
        open={showInventoryModal}
        title="Required Inventory"
        onClose={() => setShowInventoryModal(false)}
        headerAction={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700"
            aria-label="Add inventory item"
            onClick={() =>
              setInventoryDraft((prev) => [...prev, { label: "", qty: "" }])
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </button>
        }
      >
        <div className="space-y-3">
          {inventoryDraft.map((item, index) => (
            <div key={`inv-${index}`} className="space-y-2">
              {!item.label.trim() ? (
                <>
                  <ModalField
                    label="Description"
                    value={item.label}
                    onChange={(label) =>
                      setInventoryDraft((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, label } : row
                        )
                      )
                    }
                    placeholder="e.g. Profiles | Channel | 254x70 | IsoFR"
                  />
                  <ModalField
                    label="Quantity"
                    value={item.qty}
                    onChange={(qty) =>
                      setInventoryDraft((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, qty } : row))
                      )
                    }
                    type="number"
                  />
                </>
              ) : (
                <ModalField
                  label={item.label}
                  value={item.qty}
                  onChange={(qty) =>
                    setInventoryDraft((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, qty } : row))
                    )
                  }
                  type="number"
                />
              )}
            </div>
          ))}
          <button
            className="btn-primary w-full"
            disabled={isSaving}
            onClick={() =>
              void onSavePatch({
                printDetails: {
                  ...pd,
                  workflowExtras: {
                    ...extras,
                    requiredInventory: inventoryDraft.filter(
                      (item) => item.label.trim() || item.qty.trim()
                    ),
                  },
                },
              }).then(() => setShowInventoryModal(false))
            }
          >
            {isSaving ? "Saving…" : "Save inventory"}
          </button>
        </div>
      </EditModal>

      <EditModal open={showFileModal} title="Upload File" onClose={() => setShowFileModal(false)}>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Select File
            <input
              type="file"
              onChange={(e) =>
                setFileUploadDraft((prev) => ({
                  ...prev,
                  fileName: e.target.files?.[0]?.name ?? "",
                }))
              }
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Select Category
            <select
              value={fileUploadDraft.category}
              onChange={(e) => setFileUploadDraft((prev) => ({ ...prev, category: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              <option value="Specification">Specification</option>
              <option value="Drawing">Drawing</option>
              <option value="Purchase Order">Purchase Order</option>
              <option value="QA Document">QA Document</option>
              <option value="Delivery">Delivery</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <button
            className="btn-primary w-full"
            onClick={() => {
              if (!fileUploadDraft.fileName.trim()) return;
              setFiles((prev) =>
                normalizeJobFiles([
                  {
                    name: fileUploadDraft.fileName,
                    category: fileUploadDraft.category,
                    time: "just now",
                    uploadedAt: Date.now(),
                  },
                  ...prev,
                ])
              );
              setFileUploadDraft({ fileName: "", category: "Specification" });
              setShowFileModal(false);
            }}
          >
            Save File
          </button>
        </div>
      </EditModal>
    </div>
  );
}

function WidgetCard({
  title,
  icon: Icon,
  children,
  onEdit,
  headerAction,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onEdit?: () => void;
  headerAction?: React.ReactNode;
}) {
  return (
    <article className="group app-card-interactive p-4 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#111827]">
          <Icon className="h-4 w-4 shrink-0 text-[#F97316]" />
          <span className="truncate">{title}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerAction}
          {onEdit && (
            <button
              type="button"
              className="rounded-lg border border-[#E5E7EB] p-1.5 text-slate-500 opacity-0 pointer-events-none transition-opacity duration-150 hover:border-orange-200 hover:text-[#111827] group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus:opacity-100"
              onClick={onEdit}
              aria-label={`Edit ${title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1 text-sm text-slate-700">{children}</div>
    </article>
  );
}

function CustomerRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="break-words text-sm text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-orange-300"
      />
    </label>
  );
}

function EditModal({
  open,
  title,
  onClose,
  children,
  headerAction,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-lg font-semibold text-[#111827]">{title}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {headerAction}
            <button
              type="button"
              className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-slate-600 hover:border-orange-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
