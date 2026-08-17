"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheckBig,
  CircleDollarSign,
  MessageSquare,
  Download,
  Loader2,
  History,
  Mail,
  Package,
  Phone,
  Plus,
  Settings,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { ActivityAuditTrail } from "@/components/ActivityAuditTrail";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { JobNotesChatDrawer } from "@/components/JobNotesChatDrawer";
import { RaisedBySelect } from "@/components/RaisedBySelect";
import { JobTimelineAnalytics } from "@/components/JobTimelineAnalytics";
import { JobWorkflowExtrasSection } from "@/components/JobWorkflowExtrasSection";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { JobStatusCard } from "@/components/JobStatusCard";
import { JobDocumentRevisionsCard } from "@/components/JobDocumentRevisionsCard";
import { ensurePrintDetails } from "@/lib/jobCardFormDefaults";
import {
  deleteJobDocument,
  deleteJobInventoryLine,
  downloadJobDocument,
  listJobDocuments,
  listJobStages,
  saveJobInventory,
  updateJobInventoryLine,
  updateJobPayment,
  uploadJobDocument,
} from "@/lib/frp/api";
import { ensureWorkflowExtras, JOB_TYPE_OPTIONS } from "@/lib/jobWorkflowExtras";
import {
  normalizeJobFiles,
  sortJobFiles,
  type JobFileRecord,
  type JobFileSortMode,
} from "@/lib/jobFilesSort";
import { isManualPoDocument, poDocumentDisplayName } from "@/lib/poLineItems";
import { formatCreatedDate, formatShortDate, jobPriorities } from "@/lib/mockData";
import {
  uiInventoryLineToDto,
  type FrpJobDocumentDTO,
  type FrpJobStageDTO,
  type JobUpdateAuditAction,
} from "@/lib/frp/job-mapper";
import type {
  Job,
  JobInventoryLine,
  JobPriority,
  JobWorkflowExtras,
} from "@/lib/types";
import {
  getAssignableWorkers,
  getWorkerDisplayName,
  resolveWorkerNameFromId,
} from "@/lib/workers";
import { isCancelledJob } from "@/lib/frp/job-status";

interface JobWorkflowDashboardProps {
  job: Job;
  isSaving: boolean;
  isExporting?: boolean;
  saveError: string | null;
  saveSuccess?: boolean;
  auditRefreshKey?: number;
  onPrint: () => void;
  /** Soft-cancel the job (DELETE /jobs/{id}). Prefer over status patch. */
  onCancelJob?: () => Promise<void>;
  onSavePatch: (
    patch: Partial<Job>,
    options?: { audit?: JobUpdateAuditAction; auditDetail?: string | null }
  ) => Promise<void>;
  /** Refetch the job after a stage change so the page reflects the new status. */
  onJobChanged?: () => void | Promise<void>;
}

/**
 * The checklist comes from the server now, labels and all — it owns the five
 * values its CHECK constraint accepts, so the client keeping a parallel copy
 * could only ever drift from it.
 */

type JobFile = JobFileRecord;

const SHAREPOINT_POLL_INTERVAL_MS = 10_000;
const SHAREPOINT_PENDING_TIMEOUT_MS = 90_000;
const SHAREPOINT_FAILED_HINT =
  "SharePoint did not store this file. Delete it and upload again.";

function formatDocUploadedAt(iso?: string): { time: string; uploadedAt?: number } {
  if (!iso) return { time: "Uploaded" };
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { time: iso.slice(0, 10) };
  return { time: formatShortDate(iso.slice(0, 10)), uploadedAt: ms };
}

function documentTypeLabel(doc: FrpJobDocumentDTO): string {
  if (doc.milestoneStageName?.trim()) return doc.milestoneStageName.trim();
  switch (doc.documentType) {
    case "DRAWING":
      return "Drawing";
    case "PRODUCTION":
      return "Production";
    case "QC":
      return "QC";
    default:
      return "Other";
  }
}

function docToFileRecord(doc: FrpJobDocumentDTO): JobFile {
  const when = formatDocUploadedAt(doc.uploadedAt);
  return {
    name: poDocumentDisplayName(doc, undefined, "Untitled"),
    category: documentTypeLabel(doc),
    time: when.time,
    uploadedAt: when.uploadedAt,
    documentId: doc.id,
    documentType: doc.documentType,
    isManualEntry: isManualPoDocument(doc),
    storageStatus: doc.storageStatus,
    remarks: doc.remarks ?? null,
  };
}

type InventoryDraftLine = JobInventoryLine & { localKey: string };

function newInventoryKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyInventoryLine(): InventoryDraftLine {
  return {
    category: "",
    profileType: "",
    size: "",
    materialGrade: "",
    quantity: null,
    description: "",
    localKey: newInventoryKey(),
  };
}

function toInventoryDraft(lines: JobInventoryLine[]): InventoryDraftLine[] {
  return lines.map((line) => ({
    ...line,
    localKey: line.id != null ? `saved-${line.id}` : newInventoryKey(),
  }));
}

function inventoryField(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function inventoryLinesEqual(a: JobInventoryLine, b: JobInventoryLine): boolean {
  return (
    inventoryField(a.category) === inventoryField(b.category) &&
    inventoryField(a.profileType) === inventoryField(b.profileType) &&
    inventoryField(a.size) === inventoryField(b.size) &&
    inventoryField(a.materialGrade) === inventoryField(b.materialGrade) &&
    inventoryField(a.description) === inventoryField(b.description) &&
    (a.quantity ?? 0) === (b.quantity ?? 0)
  );
}

function isInventoryLineIncomplete(item: JobInventoryLine): boolean {
  return !item.category?.trim() || !item.profileType?.trim();
}

const INVENTORY_TABLE_HEADERS = [
  "Category",
  "Profile",
  "Size",
  "Grade",
  "Qty",
  "Description",
] as const;

function inventoryCell(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text || "—";
}

function isBlankInventoryLine(item: JobInventoryLine): boolean {
  return (
    !item.category?.trim() &&
    !item.profileType?.trim() &&
    !item.size?.trim() &&
    !item.materialGrade?.trim() &&
    !item.description?.trim() &&
    item.quantity == null
  );
}

function parseInventoryQuantity(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function patchInventoryLine(
  lines: InventoryDraftLine[],
  localKey: string,
  patch: Partial<JobInventoryLine>
): InventoryDraftLine[] {
  return lines.map((row) =>
    row.localKey === localKey ? { ...row, ...patch } : row
  );
}

/** A `measurement` row's display fields — raw Quotient `selected_items` shape.
 *  `job.measurement` starts as the quote's own selected_items for a
 *  quote-derived job (set at creation, QuotientEventProcessor.createJobIfAbsent)
 *  and gets overwritten with the approved PO's line items once one lands
 *  (JobDocumentServiceImpl.applyApprovedPoToJob) — one evolving field, so
 *  reading it directly always shows the current authoritative item list. */
/** Matches PoManualEntryFields.tsx's CURRENCY_OPTIONS. Falls back to the
 *  raw ISO code for anything not in this list. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  AUD: "A$",
  USD: "US$",
  NZD: "NZ$",
  GBP: "£",
  EUR: "€",
  INR: "₹",
  SAR: "SAR",
  AED: "AED",
  CAD: "C$",
};

function orderItemFields(item: Record<string, unknown>): {
  code: string;
  name: string;
  qty: string;
  price: string;
} {
  const str = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
  // sourceCode: manual/PO-entered rows (lib/poLineItems.ts). item_code/itemCode:
  // Quotient's own selected_items shape.
  const priceRaw = item.unit_price ?? item.unitPrice ?? item.price;
  return {
    code: str(item.sourceCode ?? item.item_code ?? item.itemCode),
    name: str(item.heading ?? item.description),
    qty: str(item.quantity),
    price: typeof priceRaw === "number" ? priceRaw.toFixed(2) : str(priceRaw),
  };
}

/** Top-level milestones only (same set Status Control offers), excluding draft. */
function asMilestones(stages: FrpJobStageDTO[]): FrpJobStageDTO[] {
  return stages
    .filter((m) => m.stageKey !== "draft" && m.id != null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function JobWorkflowDashboard({
  job,
  isSaving,
  isExporting = false,
  saveError,
  saveSuccess,
  auditRefreshKey = 0,
  onPrint,
  onCancelJob,
  onSavePatch,
  onJobChanged,
}: JobWorkflowDashboardProps) {
  const cancelled = isCancelledJob(job.status);
  const pd = ensurePrintDetails(job);
  const extras = ensureWorkflowExtras(pd.workflowExtras, job);
  const orderItems = job.measurement ?? [];

  const [showJobModal, setShowJobModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);
  const pendingSharePointSeenAt = useRef<Map<number, number>>(new Map());
  const [sharePointTimedOutIds, setSharePointTimedOutIds] = useState<Set<number>>(
    () => new Set()
  );
  const [failedFile, setFailedFile] = useState<JobFile | null>(null);
  const [failedFileBusy, setFailedFileBusy] = useState(false);
  const [versionsFocus, setVersionsFocus] = useState<{
    documentId: number;
    tab: "po" | "drawing";
  } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [fileSort, setFileSort] = useState<JobFileSortMode>("recents");
  const [milestones, setMilestones] = useState<FrpJobStageDTO[]>([]);
  const [fileUploadDraft, setFileUploadDraft] = useState<{
    file: File | null;
    milestoneId: number | "";
  }>({ file: null, milestoneId: "" });
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
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
    description: job.description ?? job.manualInstructions ?? "",
    assignedWorkerId: job.assignedWorkerId ?? "",
    raisedBy: pd.raisedBy ?? "",
    jobType: job.jobType ?? extras.jobType ?? "",
    projectedStartDate: extras.projectedStartDate ?? "",
  });
  const [inventoryDraft, setInventoryDraft] = useState<InventoryDraftLine[]>(
    () => toInventoryDraft(job.inventory ?? [])
  );
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [jobCardNotesDraft, setJobCardNotesDraft] = useState(extras.jobCardNotes ?? "");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const assignableWorkers = getAssignableWorkers();

  useEffect(() => {
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
    let cancelled = false;
    async function loadProjectDocuments() {
      if (!job.dbId) {
        setFiles([]);
        setMilestones([]);
        return;
      }
      try {
        const [docs, stages] = await Promise.all([
          listJobDocuments(job.dbId, { sort: "ALL" }),
          listJobStages(job.dbId),
        ]);
        if (cancelled) return;
        const nextMilestones = asMilestones(stages);
        setMilestones(nextMilestones);
        setFiles(normalizeJobFiles(docs.map(docToFileRecord)));
        setFileUploadDraft((prev) => {
          if (prev.milestoneId !== "" && nextMilestones.some((m) => m.id === prev.milestoneId)) {
            return prev;
          }
          return { ...prev, milestoneId: nextMilestones[0]?.id ?? "" };
        });
      } catch {
        if (!cancelled) {
          setFiles([]);
          setMilestones([]);
        }
      }
    }
    void loadProjectDocuments();
    return () => {
      cancelled = true;
    };
  }, [job.dbId, documentsRefreshKey]);

  useEffect(() => {
    window.localStorage.setItem(`frp-notes-${job.id}`, JSON.stringify(notes));
  }, [job.id, notes]);

  useEffect(() => {
    window.localStorage.setItem(`frp-files-sort-${job.id}`, fileSort);
  }, [job.id, fileSort]);

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
      description: job.description ?? job.manualInstructions ?? "",
      assignedWorkerId: job.assignedWorkerId ?? "",
      raisedBy: nextPd.raisedBy ?? "",
      jobType: job.jobType ?? nextExtras.jobType ?? "",
      projectedStartDate: nextExtras.projectedStartDate ?? "",
    });
    if (!showInventoryModal) {
      setInventoryDraft(toInventoryDraft(job.inventory ?? []));
    }
    setJobCardNotesDraft(nextExtras.jobCardNotes ?? "");
  }, [job, showInventoryModal]);

  const sortedFiles = useMemo(
    () => sortJobFiles(files, fileSort),
    [files, fileSort]
  );

  const filesWithSharePointTimeout = useMemo(() => {
    if (sharePointTimedOutIds.size === 0) return sortedFiles;
    return sortedFiles.map((file) =>
      file.documentId != null &&
      sharePointTimedOutIds.has(file.documentId) &&
      file.storageStatus === "PENDING"
        ? { ...file, storageStatus: "FAILED" as const, remarks: SHAREPOINT_FAILED_HINT }
        : file
    );
  }, [sortedFiles, sharePointTimedOutIds]);

  const displayFiles = useMemo(() => {
    if (!fileUploading || !fileUploadDraft.file) return filesWithSharePointTimeout;
    const optimistic: JobFile = {
      name: fileUploadDraft.file.name,
      category: "Uploading",
      time: "just now",
      uploadedAt: Date.now(),
      storageStatus: "PENDING",
    };
    return [
      optimistic,
      ...filesWithSharePointTimeout.filter((f) => f.name !== optimistic.name),
    ];
  }, [fileUploading, fileUploadDraft.file, filesWithSharePointTimeout]);

  useEffect(() => {
    const now = Date.now();
    const seen = pendingSharePointSeenAt.current;
    const pendingIds = new Set<number>();
    for (const file of files) {
      if (file.storageStatus === "PENDING" && file.documentId != null) {
        pendingIds.add(file.documentId);
        if (!seen.has(file.documentId)) seen.set(file.documentId, now);
      }
    }
    for (const id of [...seen.keys()]) {
      if (!pendingIds.has(id)) seen.delete(id);
    }
    setSharePointTimedOutIds((prev) => {
      const next = new Set<number>();
      for (const id of prev) {
        if (pendingIds.has(id)) next.add(id);
      }
      if (next.size === prev.size) {
        let same = true;
        for (const id of prev) {
          if (!next.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [files]);

  const hasPendingSharePoint = files.some(
    (f) =>
      f.storageStatus === "PENDING" &&
      (f.documentId == null || !sharePointTimedOutIds.has(f.documentId))
  );

  useEffect(() => {
    if (!job.dbId || !hasPendingSharePoint) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const timedOut: number[] = [];
      let stillWaiting = false;
      for (const [id, startedAt] of pendingSharePointSeenAt.current) {
        if (now - startedAt >= SHAREPOINT_PENDING_TIMEOUT_MS) {
          timedOut.push(id);
        } else {
          stillWaiting = true;
        }
      }
      if (timedOut.length > 0) {
        setSharePointTimedOutIds((prev) => {
          const next = new Set(prev);
          let added = false;
          for (const id of timedOut) {
            if (!next.has(id)) {
              next.add(id);
              added = true;
            }
          }
          return added ? next : prev;
        });
      }
      if (stillWaiting) {
        setDocumentsRefreshKey((k) => k + 1);
      }
    }, SHAREPOINT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [job.dbId, hasPendingSharePoint]);

  const systemNote = job.createdAt
    ? `Job created and added to the fabrication queue · ${formatCreatedDate(job.createdAt)}`
    : "Job created and added to the fabrication queue";

  const assignedLabel =
    job.assignedWorkerName || getWorkerDisplayName(job.assignedWorkerId);

  const postNote = () => {
    if (!noteDraft.trim()) return;
    setNotes((prev) =>
      [`${new Date().toLocaleTimeString()} ${noteDraft.trim()}`, ...prev].slice(0, 24)
    );
    setNoteDraft("");
  };

  const openFileUploadModal = () => {
    setFileUploadError(null);
    setFileUploadDraft({
      file: null,
      milestoneId: milestones[0]?.id ?? "",
    });
    setShowFileModal(true);
  };

  const openDocumentVersions = (input: {
    documentId?: number;
    documentType?: FrpJobDocumentDTO["documentType"];
  }) => {
    if (input.documentId == null) return;
    const tab =
      input.documentType === "DRAWING"
        ? "drawing"
        : input.documentType === "PRODUCTION"
          ? "po"
          : null;
    if (!tab) return;
    setVersionsFocus({ documentId: input.documentId, tab });
    window.requestAnimationFrame(() => {
      document.getElementById("job-document-versions")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleOpenProjectFile = (file: JobFileRecord) => {
    if (file.storageStatus === "PENDING" || file.storageStatus === "FAILED") {
      if (file.storageStatus === "FAILED") setFailedFile(file);
      return;
    }
    openDocumentVersions({
      documentId: file.documentId,
      documentType: file.documentType,
    });
  };

  const handleFailedSharePointFile = (file: JobFileRecord) => {
    setFailedFile(file);
  };

  const handleDeleteFailedSharePointFile = async () => {
    if (failedFile?.documentId == null) return;
    setFailedFileBusy(true);
    try {
      await deleteJobDocument(failedFile.documentId);
      setFailedFile(null);
      setDocumentsRefreshKey((k) => k + 1);
      if (!cancelled) openFileUploadModal();
    } catch {
      // Leave the dialog open so the user can retry or close.
    } finally {
      setFailedFileBusy(false);
    }
  };

  const handleDownloadFile = async (file: JobFileRecord) => {
    if (file.storageStatus === "PENDING" || file.storageStatus === "FAILED") {
      return;
    }
    if (
      (file.documentType === "PRODUCTION" || file.documentType === "DRAWING") &&
      file.documentId != null
    ) {
      handleOpenProjectFile(file);
      return;
    }
    if (file.documentId == null) return;
    try {
      const res = await downloadJobDocument(file.documentId);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Best-effort download — leave the strip as-is.
    }
  };

  /** Detail-panel "Download" for versioned PO/drawing docs — always fetches
   *  the file itself (unlike `handleDownloadFile`, which redirects those
   *  document types to Document Versions instead). */
  const handleDownloadVersionFile = async (file: JobFileRecord) => {
    if (file.documentId == null) return;
    if (file.storageStatus === "PENDING" || file.storageStatus === "FAILED") {
      return;
    }
    try {
      const res = await downloadJobDocument(file.documentId);
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Best-effort download — leave the strip as-is.
    }
  };

  const handleUploadProjectDocument = async () => {
    if (!job.dbId || !fileUploadDraft.file || fileUploadDraft.milestoneId === "") return;
    setFileUploading(true);
    setFileUploadError(null);
    try {
      await uploadJobDocument(job.dbId, {
        jobStageId: fileUploadDraft.milestoneId,
        file: fileUploadDraft.file,
        documentName: fileUploadDraft.file.name,
      });
      setShowFileModal(false);
      setFileUploadDraft({ file: null, milestoneId: milestones[0]?.id ?? "" });
      setDocumentsRefreshKey((k) => k + 1);
    } catch (e) {
      setFileUploadError(e instanceof Error ? e.message : "Could not upload document");
    } finally {
      setFileUploading(false);
    }
  };

  const savePayment = async (body: { paid?: boolean; estimatedDate?: string }) => {
    if (!job.dbId) return;
    setPaymentBusy(true);
    setPaymentError(null);
    try {
      await updateJobPayment(job.dbId, body);
      await onJobChanged?.();
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Could not update payment");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handlePaymentReceivedChange = (value: boolean) => {
    void savePayment({ paid: value });
  };

  const handlePaymentDueDateChange = (date: string) => {
    if (!date) return;
    void savePayment({ estimatedDate: date });
  };

  const openInventoryEditor = () => {
    const current = toInventoryDraft(job.inventory ?? []);
    setInventoryDraft(current.length === 0 ? [emptyInventoryLine()] : current);
    setInventoryError(null);
    setShowInventoryModal(true);
  };

  const closeInventoryEditor = () => {
    if (inventoryBusy) return;
    setShowInventoryModal(false);
    setInventoryError(null);
    setInventoryDraft(toInventoryDraft(job.inventory ?? []));
  };

  const addInventoryLine = () => {
    setInventoryDraft((prev) => [...prev, emptyInventoryLine()]);
  };

  const removeInventoryLine = (localKey: string) => {
    setInventoryDraft((prev) => prev.filter((row) => row.localKey !== localKey));
    setInventoryError(null);
  };

  const saveInventory = async () => {
    if (!job.dbId) return;
    const filled = inventoryDraft.filter((item) => !isBlankInventoryLine(item));
    if (filled.some(isInventoryLineIncomplete)) {
      setInventoryError(
        "Each inventory line needs a category and a profile type."
      );
      return;
    }

    const original = job.inventory ?? [];
    const originalById = new Map(
      original
        .filter((line) => line.id != null)
        .map((line) => [line.id as number, line])
    );
    const keptIds = new Set(
      filled.filter((line) => line.id != null).map((line) => line.id as number)
    );
    const toDelete = [...originalById.keys()].filter((id) => !keptIds.has(id));
    const toUpdate = filled.filter((line) => {
      if (line.id == null) return false;
      const previous = originalById.get(line.id);
      return !previous || !inventoryLinesEqual(line, previous);
    });
    const toCreate = filled.filter((line) => line.id == null);

    setInventoryBusy(true);
    setInventoryError(null);
    try {
      await Promise.all([
        ...toDelete.map((id) => deleteJobInventoryLine(job.dbId!, id)),
        ...toUpdate.map((line) =>
          updateJobInventoryLine(job.dbId!, line.id!, uiInventoryLineToDto(line))
        ),
      ]);
      if (toCreate.length > 0) {
        await saveJobInventory(
          job.dbId,
          toCreate.map((line) => {
            const dto = uiInventoryLineToDto(line);
            delete dto.id;
            return dto;
          })
        );
      }
      await onJobChanged?.();
      setShowInventoryModal(false);
    } catch (e) {
      setInventoryError(
        e instanceof Error ? e.message : "Could not save inventory"
      );
    } finally {
      setInventoryBusy(false);
    }
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
            disabled={isExporting || isSaving || cancelBusy}
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
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
            disabled={
              isSaving ||
              cancelBusy ||
              isExporting ||
              job.status === "Cancelled" ||
              job.status === "Complete"
            }
            onClick={() => setShowCancelConfirm(true)}
          >
            Cancel job
          </button>
        </div>
      </div>

      <JobTimelineAnalytics job={job} />

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
        files={displayFiles}
        fileSort={fileSort}
        onFileSortChange={setFileSort}
        onUploadFile={cancelled ? () => undefined : openFileUploadModal}
        onDownloadFile={handleDownloadFile}
        onOpenFile={handleOpenProjectFile}
        onDownloadVersionFile={handleDownloadVersionFile}
        onFailedFile={handleFailedSharePointFile}
      />

      <div className="mt-4 space-y-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <WidgetCard title="Customer Details" icon={User} onEdit={cancelled ? undefined : () => setShowCustomerModal(true)}>
          <CustomerRow icon={User} label="Contact" value={job.clientContactName || "—"} />
          <CustomerRow icon={Phone} label="Phone" value={pd.contactPhone?.trim() || "—"} />
          <CustomerRow icon={Mail} label="Email" value={pd.contactEmail?.trim() || "—"} />
        </WidgetCard>

        <WidgetCard
          title="Job Details"
          icon={Settings}
          onEdit={cancelled ? undefined : () => setShowJobModal(true)}
        >
          <p className="font-medium text-slate-800">{job.projectName}</p>
          <p className="text-sm text-slate-600">
            Assigned: {assignedLabel === "Unassigned" ? "Unassigned" : assignedLabel}
          </p>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {job.description?.trim() ||
              job.manualInstructions?.trim() ||
              "No description provided."}
          </p>
          <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            {job.priority}
          </span>
          <p className="text-sm text-slate-500">
            Type: {job.jobType || extras.jobType || "—"} · Stage:{" "}
            {cancelled ? "Cancelled" : job.status}
          </p>
          <p className="text-sm text-slate-500">
            Due: {job.dueDate ? formatShortDate(job.dueDate) : "Not set"}
            {extras.projectedStartDate
              ? ` · Start: ${formatShortDate(extras.projectedStartDate)}`
              : ""}
          </p>
          <p className="text-sm text-slate-500">Raised by: {pd.raisedBy ?? "—"}</p>
          {orderItems.length > 0 && (
            <p className="text-sm text-slate-500">Order Items: {orderItems.length}</p>
          )}
        </WidgetCard>

        <JobStatusCard
          job={job}
          onJobChanged={onJobChanged}
          onDocumentsChanged={() => setDocumentsRefreshKey((k) => k + 1)}
          onOpenDocument={(doc) =>
            openDocumentVersions({ documentId: doc.id, documentType: doc.documentType })
          }
          className="lg:col-span-2"
        />

        <JobDocumentRevisionsCard
          job={job}
          refreshKey={documentsRefreshKey}
          focusDocument={versionsFocus}
          onJobChanged={onJobChanged}
          className="lg:col-span-2"
        />

        <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
          <WidgetCard title="Manufacturing" icon={CircleCheckBig}>
            <label className="mt-2 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={job.status === "In Fabrication" || job.status === "Ready to Manufacture"}
                disabled={isSaving || cancelled}
                onChange={(e) =>
                  void onSavePatch({
                    status: e.target.checked ? "In Fabrication" : "Pending",
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300 disabled:opacity-50"
              />
              Ready to Manufacture
            </label>
          </WidgetCard>

          <WidgetCard title="Payment Status" icon={CircleDollarSign}>
            {paymentError ? (
              <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {paymentError}
              </p>
            ) : null}
            <fieldset className="mt-2 space-y-2">
              <legend className="text-sm text-slate-700">Payment received</legend>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`payment-received-${job.id}`}
                    checked={extras.paymentReceived === true}
                    disabled={isSaving || paymentBusy || cancelled || !job.dbId}
                    onChange={() => handlePaymentReceivedChange(true)}
                    className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-300 disabled:opacity-50"
                  />
                  Yes
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`payment-received-${job.id}`}
                    checked={extras.paymentReceived === false}
                    disabled={isSaving || paymentBusy || cancelled || !job.dbId}
                    onChange={() => handlePaymentReceivedChange(false)}
                    className="h-4 w-4 border-slate-300 text-orange-600 focus:ring-orange-300 disabled:opacity-50"
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
                disabled={isSaving || paymentBusy || cancelled || !job.dbId}
                onChange={(e) => handlePaymentDueDateChange(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#111827] outline-none focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40 disabled:opacity-50"
              />
            </label>
          </WidgetCard>
        </div>

        <WidgetCard
          title="Inventory"
          icon={Package}
          onEdit={cancelled ? undefined : openInventoryEditor}
          className="lg:col-span-2"
        >
          {(job.inventory ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No inventory lines yet.</p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {INVENTORY_TABLE_HEADERS.map((header) => (
                      <th key={header} className="px-2 py-2 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(job.inventory ?? []).map((item, index) => (
                    <tr
                      key={item.id ?? index}
                      className="border-b border-[#E5E7EB] last:border-0"
                    >
                      <td className="px-2 py-2 font-medium text-slate-800">
                        {inventoryCell(item.category)}
                      </td>
                      <td className="px-2 py-2">{inventoryCell(item.profileType)}</td>
                      <td className="px-2 py-2">{inventoryCell(item.size)}</td>
                      <td className="px-2 py-2">{inventoryCell(item.materialGrade)}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {inventoryCell(item.quantity)}
                      </td>
                      <td className="px-2 py-2 text-slate-600">
                        {inventoryCell(item.description)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            disabled={isSaving || cancelled || !jobCardNotesDirty}
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
          role="status"
        >
          {saveError ||
            (job.status === "Cancelled"
              ? "Job cancelled. It remains in the register for audit."
              : "Saved. PDF export reflects updated fields.")}
        </p>
      )}
      </div>

      <ConfirmDialog
        open={failedFile != null}
        title="Upload failed"
        description={SHAREPOINT_FAILED_HINT}
        confirmLabel="Delete file"
        cancelLabel="Close"
        tone="danger"
        busy={failedFileBusy}
        onClose={() => {
          if (!failedFileBusy) setFailedFile(null);
        }}
        onConfirm={() => {
          void handleDeleteFailedSharePointFile();
        }}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title={`Cancel job ${job.id}?`}
        description="This marks the job as cancelled in the workflow. The record is kept for audit — it is not permanently deleted."
        confirmLabel="Cancel job"
        cancelLabel="Keep job active"
        tone="danger"
        busy={cancelBusy}
        onClose={() => {
          if (!cancelBusy) setShowCancelConfirm(false);
        }}
        onConfirm={async () => {
          setCancelBusy(true);
          try {
            if (onCancelJob) {
              await onCancelJob();
            } else {
              await onSavePatch({ status: "Cancelled" });
            }
            setShowCancelConfirm(false);
          } finally {
            setCancelBusy(false);
          }
        }}
      />

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
              value={jobDraft.description}
              onChange={(e) => setJobDraft((p) => ({ ...p, description: e.target.value }))}
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
              <option value="">Not set</option>
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
          {orderItems.length > 0 && (
            <div className="rounded-lg border border-[#E5E7EB] bg-slate-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Order Items
              </p>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="pb-1 pr-2 font-medium">Code</th>
                      <th className="pb-1 pr-2 font-medium">Item</th>
                      <th className="pb-1 pr-2 font-medium">Qty</th>
                      <th className="pb-1 font-medium">
                        Price
                        {job.currency ? ` (${CURRENCY_SYMBOLS[job.currency] ?? job.currency})` : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, i) => {
                      const f = orderItemFields(item);
                      return (
                        <tr key={i} className="border-t border-[#E5E7EB]/70">
                          <td className="py-1 pr-2 font-mono text-slate-600">{f.code}</td>
                          <td className="py-1 pr-2 text-slate-800">{f.name}</td>
                          <td className="py-1 pr-2 text-slate-600">{f.qty}</td>
                          <td className="py-1 text-slate-600">{f.price}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <button
            className="btn-primary w-full"
            onClick={() => {
              const workerId = jobDraft.assignedWorkerId || null;
              void onSavePatch({
                projectName: jobDraft.projectName.trim() || job.projectName,
                status: jobDraft.status,
                dueDate: jobDraft.dueDate.trim() || null,
                priority: jobDraft.priority,
                description: jobDraft.description.trim() || null,
                jobType: jobDraft.jobType.trim() || null,
                assignedWorkerId: workerId,
                assignedWorkerName: resolveWorkerNameFromId(workerId),
                printDetails: {
                  ...ensurePrintDetails(job),
                  raisedBy: jobDraft.raisedBy,
                  workflowExtras: {
                    ...ensureWorkflowExtras(pd.workflowExtras, job),
                    jobType: jobDraft.jobType.trim() || undefined,
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
        title="Add Inventory"
        onClose={closeInventoryEditor}
        headerAction={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700 disabled:opacity-50"
            aria-label="Add inventory item"
            disabled={inventoryBusy}
            onClick={addInventoryLine}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </button>
        }
      >
        <div className="space-y-3">
          {inventoryError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {inventoryError}
            </p>
          ) : null}
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {inventoryDraft.map((item, index) => (
              <div key={item.localKey} className="space-y-3">
                {item.id != null || inventoryDraft.length > 1 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#111827]">
                      {inventoryDraft.length > 1 ? `Line ${index + 1}` : "Item"}
                    </p>
                    <button
                      type="button"
                      aria-label="Remove inventory line"
                      disabled={inventoryBusy}
                      className="rounded-lg border border-[#E5E7EB] p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                      onClick={() => removeInventoryLine(item.localKey)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : null}
                <ModalField
                  label="Category"
                  value={item.category ?? ""}
                  disabled={inventoryBusy}
                  placeholder="e.g. Fixings"
                  onChange={(category) =>
                    setInventoryDraft((prev) =>
                      patchInventoryLine(prev, item.localKey, { category })
                    )
                  }
                />
                <ModalField
                  label="Profile type"
                  value={item.profileType ?? ""}
                  disabled={inventoryBusy}
                  placeholder="e.g. Clip"
                  onChange={(profileType) =>
                    setInventoryDraft((prev) =>
                      patchInventoryLine(prev, item.localKey, { profileType })
                    )
                  }
                />
                <ModalField
                  label="Size"
                  value={item.size ?? ""}
                  disabled={inventoryBusy}
                  placeholder="e.g. M8"
                  onChange={(size) =>
                    setInventoryDraft((prev) =>
                      patchInventoryLine(prev, item.localKey, { size })
                    )
                  }
                />
                <ModalField
                  label="Material grade"
                  value={item.materialGrade ?? ""}
                  disabled={inventoryBusy}
                  placeholder="e.g. 316"
                  onChange={(materialGrade) =>
                    setInventoryDraft((prev) =>
                      patchInventoryLine(prev, item.localKey, { materialGrade })
                    )
                  }
                />
                <ModalField
                  label="Quantity"
                  value={item.quantity != null ? String(item.quantity) : ""}
                  disabled={inventoryBusy}
                  type="number"
                  onChange={(qty) =>
                    setInventoryDraft((prev) =>
                      patchInventoryLine(prev, item.localKey, {
                        quantity: parseInventoryQuantity(qty),
                      })
                    )
                  }
                />
                <ModalField
                  label="Description"
                  value={item.description ?? ""}
                  disabled={inventoryBusy}
                  multiline
                  placeholder="Optional notes"
                  onChange={(description) =>
                    setInventoryDraft((prev) =>
                      patchInventoryLine(prev, item.localKey, { description })
                    )
                  }
                />
              </div>
            ))}
          </div>
          <button
            className="btn-primary w-full"
            disabled={inventoryBusy || !job.dbId}
            onClick={() => void saveInventory()}
          >
            {inventoryBusy ? "Saving…" : "Save"}
          </button>
        </div>
      </EditModal>

      <EditModal
        open={showFileModal}
        title="Upload File"
        onClose={() => {
          if (fileUploading) return;
          setShowFileModal(false);
        }}
      >
        <div className="space-y-3">
          {!job.dbId ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This job is not linked to the backend yet — documents cannot be uploaded.
            </p>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">
            Select File
            <input
              type="file"
              disabled={!job.dbId || fileUploading}
              onChange={(e) =>
                setFileUploadDraft((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] ?? null,
                }))
              }
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700 disabled:opacity-60"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Milestone
            <select
              value={fileUploadDraft.milestoneId === "" ? "" : String(fileUploadDraft.milestoneId)}
              disabled={!job.dbId || fileUploading || milestones.length === 0}
              onChange={(e) =>
                setFileUploadDraft((prev) => ({
                  ...prev,
                  milestoneId: e.target.value ? Number(e.target.value) : "",
                }))
              }
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm disabled:opacity-60"
            >
              {milestones.length === 0 ? (
                <option value="">No milestones available</option>
              ) : (
                milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.stageName ?? m.stageKey ?? `Stage ${m.id}`}
                  </option>
                ))
              )}
            </select>
          </label>
          {fileUploadError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fileUploadError}
            </p>
          ) : null}
          <button
            className="btn-primary inline-flex w-full items-center justify-center gap-2"
            disabled={
              fileUploading ||
              !job.dbId ||
              !fileUploadDraft.file ||
              fileUploadDraft.milestoneId === ""
            }
            onClick={() => void handleUploadProjectDocument()}
          >
            {fileUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              "Upload document"
            )}
          </button>
        </div>
      </EditModal>
    </div>
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

