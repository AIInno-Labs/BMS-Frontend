"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, ListChecks, Loader2, Mail, Paperclip, Pencil, StickyNote, X } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { PoManualEntryFields, type PoDetailsFormValue } from "@/components/PoManualEntryFields";
import { useAuth } from "@/context/AuthContext";
import { ACCESS_KEYS } from "@/lib/frp/access";
import {
  createManualPoDocument,
  deleteJobDocument,
  listJobStages,
  updateJobStage,
} from "@/lib/frp/api";
import { buildJobTimelineAnalytics } from "@/lib/jobTimelineAnalytics";
import type { FrpJobDocumentDTO, FrpJobStageDTO, FrpJobStageUpdateRequest } from "@/lib/frp/job-mapper";
import {
  emptyPoItemRow,
  firstPoItemRowsError,
  manualPoDocumentNameFromRows,
  manualPoLineItemsFromRows,
  poDocumentDisplayName,
  type PoItemRow,
} from "@/lib/poLineItems";
import type { Job } from "@/lib/types";
import { isCancelledJob, isOnHoldJob } from "@/lib/frp/job-status";
import { isJobLockedForCashPayment } from "@/lib/frp/job-cash-payment-gate";

const DOC_PAGE_SIZE = 5;

type ModalDocListItem =
  | { kind: "new"; file: File; index: number }
  | { kind: "existing"; doc: FrpJobDocumentDTO };

interface JobStatusCardProps {
  job: Job;
  className?: string;
  /** Called after a stage change persists — lets the parent refetch the job so
   *  the main page (status badge, timeline, %) reflects the new status. */
  onJobChanged?: () => void | Promise<void>;
  /** Called after a document is uploaded or deleted so Document Versions can refetch. */
  onDocumentsChanged?: () => void;
  /** PO / drawing paperclip — parent scrolls to Document Versions. */
  onOpenDocument?: (doc: FrpJobDocumentDTO) => void;
}

const bySortOrder = (a: FrpJobStageDTO, b: FrpJobStageDTO) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

/** Milestone docs plus every child operation (e.g. QC → visual / dimensional / signoff). */
function documentsOnMilestone(
  milestone: FrpJobStageDTO | undefined
): FrpJobDocumentDTO[] {
  if (!milestone) return [];
  const out: FrpJobDocumentDTO[] = [...(milestone.documents ?? [])];
  for (const child of milestone.children ?? []) {
    out.push(...(child.documents ?? []));
  }
  return out;
}

function dedupeDocumentsById(docs: FrpJobDocumentDTO[]): FrpJobDocumentDTO[] {
  const byId = new Map<number, FrpJobDocumentDTO>();
  const withoutId: FrpJobDocumentDTO[] = [];
  for (const doc of docs) {
    if (typeof doc.id === "number") byId.set(doc.id, doc);
    else withoutId.push(doc);
  }
  return [...byId.values(), ...withoutId];
}

const QC_OPERATION_KEYS = new Set(["visual", "dimensional", "signoff"]);

const STATUS_LABEL: Record<NonNullable<FrpJobStageDTO["status"]>, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETE: "Done",
  SKIPPED: "Skipped",
  BLOCKED: "Blocked",
};

function versionsDocument(
  docs: FrpJobDocumentDTO[]
): FrpJobDocumentDTO | undefined {
  return docs.find(
    (d) => d.documentType === "PRODUCTION" || d.documentType === "DRAWING"
  );
}

function statusPillClass(status: FrpJobStageDTO["status"]): string {
  switch (status) {
    case "COMPLETE":
      return "border-green-200 bg-green-50 text-green-700";
    case "IN_PROGRESS":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "BLOCKED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500"; // PENDING / SKIPPED
  }
}

/**
 * Status Control — the live stage tree for a job, straight from
 * `GET /jobs/{id}/stages`. The dropdown picks a milestone; its operations
 * render as checkboxes whose ticked state is the real backend status. Ticking
 * one PUTs the stage and refetches, so the per-stage bar, the milestone rollup,
 * and the job's own status all move together (recomputed server-side in one
 * transaction).
 *
 * Document upload is asked for only when a stage carries `docRequired` — every
 * other stage ticks straight through. On save, each picked file is POSTed to
 * `/jobs/{id}/documents` before the stage PUT fires; a production-stage
 * "Enter manually" PO goes to `POST /jobs/{id}/documents/po` instead. The
 * backend also refuses to COMPLETE a doc-required stage with no document on
 * record.
 */
export function JobStatusCard({
  job,
  className,
  onJobChanged,
  onDocumentsChanged,
  onOpenDocument,
}: JobStatusCardProps) {
  const { can } = useAuth();
  const canCreatePo = can(ACCESS_KEYS.PO_CREATE);
  const locked =
    isCancelledJob(job.status) ||
    isJobLockedForCashPayment(job) ||
    isOnHoldJob(job.status);
  const [stages, setStages] = useState<FrpJobStageDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  // loadError means there is no stage data to show at all (gates the
  // checklist). actionError is a dismissible notice for a failed action
  // (tick/save/PO/delete) that happened AFTER stages already loaded — it
  // must never hide the checklist, since the data behind it is still valid.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  // The note modal, opened on every stage tick. It always offers the document
  // option; the stage's own `docRequired` decides whether a document is
  // mandatory. When not required, a "No attachment required" toggle is offered.
  const [modalStage, setModalStage] = useState<FrpJobStageDTO | null>(null);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [draftRemarks, setDraftRemarks] = useState("");
  const [draftNotRequired, setDraftNotRequired] = useState(false);
  const [draftEmailAttach, setDraftEmailAttach] = useState(false);
  /** Existing stage docs selected for the update email when attach is on. */
  const [draftEmailDocIds, setDraftEmailDocIds] = useState<number[]>([]);
  /** Indexes into draftFiles marked for the email (no id until after upload). */
  const [draftEmailNewIndexes, setDraftEmailNewIndexes] = useState<number[]>([]);
  const [docSearch, setDocSearch] = useState("");
  const [docsExpanded, setDocsExpanded] = useState(false);
  const [docPage, setDocPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  // True when the stage already has a document on record (`stage.documents`,
  // from the server) — re-saving remarks shouldn't be blocked on picking a
  // new file when one was already uploaded on a prior save.
  const [modalHadDocument, setModalHadDocument] = useState(false);

  // Production stages only: upload a real PO file (default, unchanged), or
  // enter its details by hand with no attachment — same form as Document
  // Versions' Add PO modal.
  const [poMode, setPoMode] = useState<"upload" | "manual">("upload");
  const [poDetails, setPoDetails] = useState<PoDetailsFormValue>({
    orderNo: "",
    orderDate: "",
    buyerName: "",
    expectedDate: "",
    currency: "",
  });
  const [poItems, setPoItems] = useState<PoItemRow[]>([emptyPoItemRow()]);

  const load = useCallback(async () => {
    if (!job.dbId) {
      setStages([]);
      setLoading(false);
      return;
    }
    try {
      setLoadError(null);
      setActionError(null);
      setStages(await listJobStages(job.dbId));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load stages");
      setStages([]);
    } finally {
      setLoading(false);
    }
  }, [job.dbId]);

  useEffect(() => {
    setLoading(true);
    void load();
    // Also refetch whenever the job's status changes from elsewhere on the
    // page — e.g. the Manufacturing "Ready to Manufacture" checkbox, or the
    // Stage/status field in the Edit Job Details modal. Both write through
    // the plain job PUT, which the backend applies by rewriting the stage
    // tree server-side (see job-mapper.ts), but `load` itself only depends
    // on job.dbId, so without this the checklist here goes stale until a
    // full page reload remounts the component.
  }, [load, job.status]);

  // "draft" is intentionally not shown in Status Control — it has no checklist
  // and nothing to action.
  const milestones = useMemo(
    () => (stages ?? []).filter((m) => m.stageKey !== "draft").sort(bySortOrder),
    [stages]
  );

  // Center the dropdown on the job's active stage the first time the tree
  // arrives, whenever a different job is opened, AND whenever the active
  // stage itself moves (e.g. ticking "Ready to Manufacture" advances the job
  // from Draft to Production) — otherwise the dropdown is left pointing at a
  // milestone that's no longer where the work actually is, even though the
  // checklist underneath it did refresh. Once the operator has manually
  // picked a milestone that's still the active one, further re-renders leave
  // their choice alone.
  const lastActiveStageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!milestones.length) return;
    const active = buildJobTimelineAnalytics(job).activeStageId;
    const activeStageMoved =
      lastActiveStageRef.current !== null && lastActiveStageRef.current !== active;
    lastActiveStageRef.current = active;
    setSelectedKey((prev) => {
      if (prev && !activeStageMoved && milestones.some((m) => m.stageKey === prev)) {
        return prev;
      }
      const onActive = milestones.find((m) => m.stageKey === active);
      const withWork = milestones.find((m) => (m.children?.length ?? 0) > 0);
      return (onActive ?? withWork ?? milestones[0]).stageKey ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, job.id, job.status]);

  const selected = milestones.find((m) => m.stageKey === selectedKey) ?? null;

  // A milestone drives its own operations; a childless milestone becomes its
  // own single tickable item so the stage can still be advanced.
  const items = useMemo<FrpJobStageDTO[]>(() => {
    if (!selected) return [];
    const kids = (selected.children ?? []).slice().sort(bySortOrder);
    return kids.length ? kids : [selected];
  }, [selected]);

  /** Persist a stage change and refetch so all rollups move together. Returns
   *  true on success. Also refreshes the parent job — a stage move can change
   *  job.status/percent, which the main page shows. */
  const persist = useCallback(
    async (
      stage: FrpJobStageDTO,
      body: FrpJobStageUpdateRequest,
      files?: File[]
    ): Promise<boolean> => {
      if (!job.dbId || stage.id == null) return false;
      setSavingId(stage.id);
      setActionError(null);
      if (files && files.length > 0) setUploading(true);
      try {
        await updateJobStage(job.dbId, stage.id, body, files);
        await load();
        await onJobChanged?.();
        if (files && files.length > 0) onDocumentsChanged?.();
        return true;
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Could not save");
        return false;
      } finally {
        setSavingId(null);
        setUploading(false);
      }
    },
    [job.dbId, load, onJobChanged, onDocumentsChanged]
  );

  const openStageModal = (stage: FrpJobStageDTO) => {
    if (locked) return;
    setModalStage(stage);
    // Files themselves aren't re-picked on open — already-uploaded documents
    // are shown read-only from `stage.documents` (see the modal body below).
    setDraftFiles([]);
    setDraftRemarks(stage.notes ?? "");
    // "No attachment required" is the inverse of the stage's docRequired flag.
    setDraftNotRequired(!(stage.docRequired ?? false));
    setDraftEmailAttach(
      stage.emailAttachmentEnabled
        ? (stage.emailDocumentAttachmentRequired ?? 0) === 1
        : false
    );
    setDraftEmailDocIds(
      (stage.documents ?? [])
        .map((d) => d.id)
        .filter((id): id is number => typeof id === "number")
    );
    setDraftEmailNewIndexes([]);
    setDocSearch("");
    setDocsExpanded(false);
    setDocPage(1);
    setModalHadDocument((stage.documents?.length ?? 0) > 0);
    // Order No / Buyer Name are fixed job-level facts — same prefill as
    // Document Versions' Add PO modal.
    setPoMode("upload");
    setPoDetails({
      orderNo: job.orderNumber ?? "",
      orderDate: "",
      buyerName: job.clientContactName ?? "",
      expectedDate: "",
      currency: "",
    });
    setPoItems([emptyPoItemRow()]);
  };

  const onToggle = (stage: FrpJobStageDTO) => {
    if (locked || savingId != null) return;
    if (stage.status === "COMPLETE") {
      void persist(stage, { status: "PENDING" });
      return;
    }
    // Ticking always opens the card — the user can add a remark (saved as the
    // stage note), plus a document when the stage requires one.
    openStageModal(stage);
  };

  const isProductionStage = selectedKey === "production";
  // Also gated on canCreatePo so a stale "manual" mode (e.g. privilege
  // revoked mid-session) can't submit through PoManualEntryFields even
  // though the toggle that sets it is hidden without PO_CREATE.
  const manualPoActive = isProductionStage && poMode === "manual" && canCreatePo;

  const qcMilestone = useMemo(
    () => milestones.find((m) => m.stageKey === "qc"),
    [milestones]
  );

  /**
   * QC ops (visual / dimensional / signoff) list every document under the QC
   * milestone — not Production, and not only the one sub-stage being completed.
   */
  const modalDocuments = useMemo(() => {
    if (!modalStage) return [];
    const key = modalStage.stageKey ?? "";
    const underQc = selectedKey === "qc" || QC_OPERATION_KEYS.has(key);
    if (underQc) {
      return dedupeDocumentsById(documentsOnMilestone(qcMilestone));
    }
    return modalStage.documents ?? [];
  }, [modalStage, selectedKey, qcMilestone]);

  const filteredModalDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return modalDocuments;
    return modalDocuments.filter((doc) => {
      const name = poDocumentDisplayName(doc).toLowerCase();
      const type = (doc.documentType ?? "").toLowerCase();
      const milestone = (doc.milestoneStageName ?? doc.milestoneStageKey ?? "").toLowerCase();
      return name.includes(q) || type.includes(q) || milestone.includes(q);
    });
  }, [modalDocuments, docSearch]);

  /** Pending picks share the same searchable list as already-uploaded docs. */
  const filteredDraftFiles = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    const entries = draftFiles.map((file, index) => ({ file, index }));
    if (!q) return entries;
    return entries.filter(({ file }) => file.name.toLowerCase().includes(q));
  }, [draftFiles, docSearch]);

  /** New files first, then existing — single list for pagination. */
  const filteredDocListItems = useMemo<ModalDocListItem[]>(() => {
    return [
      ...filteredDraftFiles.map(({ file, index }) => ({
        kind: "new" as const,
        file,
        index,
      })),
      ...filteredModalDocuments.map((doc) => ({
        kind: "existing" as const,
        doc,
      })),
    ];
  }, [filteredDraftFiles, filteredModalDocuments]);

  const docPageCount = Math.max(
    1,
    Math.ceil(filteredDocListItems.length / DOC_PAGE_SIZE)
  );

  const pagedDocListItems = useMemo(() => {
    const page = Math.min(docPage, docPageCount);
    const start = (page - 1) * DOC_PAGE_SIZE;
    return filteredDocListItems.slice(start, start + DOC_PAGE_SIZE);
  }, [filteredDocListItems, docPage, docPageCount]);

  useEffect(() => {
    setDocPage(1);
  }, [docSearch, modalStage?.id]);

  useEffect(() => {
    if (docPage > docPageCount) setDocPage(docPageCount);
  }, [docPage, docPageCount]);

  const showModalDocList =
    modalDocuments.length > 0 || draftFiles.length > 0;

  const modalDocTotal = modalDocuments.length + draftFiles.length;
  const selectedEmailCount =
    draftEmailDocIds.length + draftEmailNewIndexes.length;

  const modalOwnDocIds = useMemo(() => {
    const ids = new Set<number>();
    for (const doc of modalStage?.documents ?? []) {
      if (typeof doc.id === "number") ids.add(doc.id);
    }
    return ids;
  }, [modalStage]);

  function stageEmailBody(): Pick<
    FrpJobStageUpdateRequest,
    "emailDocumentAttachmentRequired" | "emailDocumentIds" | "emailNewUploadIndexes"
  > {
    // Admin off → -1 (not applicable). Admin on → operator 0/1.
    if (!modalStage?.emailAttachmentEnabled) {
      return { emailDocumentAttachmentRequired: -1 };
    }
    if (!draftEmailAttach) {
      return { emailDocumentAttachmentRequired: 0 };
    }
    return {
      emailDocumentAttachmentRequired: 1,
      emailDocumentIds: draftEmailDocIds,
      emailNewUploadIndexes: draftEmailNewIndexes,
    };
  }

  const saveStageModal = async () => {
    if (!modalStage || modalStage.id == null) return;
    setActionError(null);
    // A document is required unless "No attachment required" is ticked; when
    // required, something must be provided — a file (or manual line items on
    // a production stage) — unless one was already recorded on a prior save.
    const docRequired = !draftNotRequired;
    if (docRequired && !modalHadDocument) {
      if (manualPoActive) {
        if (manualPoLineItemsFromRows(poItems).length === 0) return;
      } else if (draftFiles.length === 0) {
        return;
      }
    }
    if (manualPoActive) {
      const itemsError = firstPoItemRowsError(poItems);
      if (itemsError) {
        setActionError(itemsError);
        return;
      }
    }
    const stageNotes = draftRemarks.trim();
    const stage = modalStage;
    const jobStageId = stage.id ?? job.currentStageId;
    if (jobStageId == null) {
      setActionError("This job has no stage id to attach a document to.");
      return;
    }

    if (manualPoActive) {
      // Manual PO uses the document API; remarks here are stage notes only.
      if (job.dbId) {
        try {
          await createManualPoDocument(job.dbId, {
            jobStageId,
            documentName: manualPoDocumentNameFromRows(poDetails.orderNo, poItems),
            orderNo: poDetails.orderNo.trim() || undefined,
            orderDate: poDetails.orderDate.trim() || undefined,
            expectedDate: poDetails.expectedDate.trim() || undefined,
            buyerName: poDetails.buyerName.trim() || undefined,
            quoteNumber: job.quoteNumber?.trim() || undefined,
            currency: poDetails.currency.trim() || undefined,
            lineItems: manualPoLineItemsFromRows(poItems),
          });
          onDocumentsChanged?.();
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "Could not add PO");
          return;
        }
      }
      const ok = await persist(stage, {
        status: "COMPLETE",
        notes: stageNotes,
        docRequired,
        ...stageEmailBody(),
      });
      if (ok) setModalStage(null);
      return;
    }

    const ok = await persist(
      stage,
      {
        status: "COMPLETE",
        notes: stageNotes,
        docRequired,
        ...stageEmailBody(),
      },
      draftFiles.length > 0 ? draftFiles : undefined
    );
    if (ok) setModalStage(null);
  };

  /** Deletes an already-uploaded document. Purely a document action — it
   *  doesn't touch the stage's own COMPLETE status either way. */
  const handleDeleteDocument = async (docId: number, docName?: string) => {
    if (locked) return;
    if (!window.confirm(`Delete ${docName ?? "this document"}?`)) return;
    setDeletingDocId(docId);
    setActionError(null);
    try {
      await deleteJobDocument(docId);
      // Update the open modal immediately; `load()` keeps the checklist
      // badge (outside the modal) in sync with the same server truth.
      setModalStage((prev) =>
        prev
          ? { ...prev, documents: (prev.documents ?? []).filter((d) => d.id !== docId) }
          : prev
      );
      setDraftEmailDocIds((prev) => prev.filter((id) => id !== docId));
      onDocumentsChanged?.();
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete document");
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <>
      <WidgetCard title="Status Control" icon={ListChecks} className={className}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-2.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Current status
          </span>
          <span className="text-sm font-semibold text-orange-700">
            {isCancelledJob(job.status) ? "Cancelled" : job.status}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stages…
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-sm text-red-700">
            {loadError}
          </div>
        ) : (
          <>
            {/* A failed action (tick/save/PO/delete) never hides the checklist
                below — the stage data it's built from is still valid, so the
                error is just a dismissible notice, not a blocking state. */}
            {actionError && (
              <div className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-sm text-red-700">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="shrink-0 text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {milestones.length === 0 ? (
              <p className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm text-slate-600">
                No stages for this job yet.
              </p>
            ) : (
              <>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              View checklist for
              <select
                value={selectedKey ?? ""}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-normal normal-case text-[#111827]"
              >
                {milestones.map((m) => (
                  <option key={m.stageKey} value={m.stageKey ?? ""}>
                    {m.stageName}
                  </option>
                ))}
              </select>
            </label>

            {selected && (
              <div className="mt-3">
                {/* The top: the parent milestone itself — its name and rollup
                    stay visible whether we drill into children below or the
                    milestone is its own single tickable item. */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="min-w-0 shrink-0 truncate text-xs font-semibold text-slate-700">
                    {selected.stageName}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${selected.percentComplete ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-500">
                    {selected.percentComplete ?? 0}%
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((item) => {
                    const done = item.status === "COMPLETE";
                    const saving = savingId === item.id;
                    const docs = item.documents ?? [];
                    return (
                      <div
                        key={item.id ?? item.stageKey}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                          done
                            ? "border-green-200 bg-green-50/50"
                            : "border-[#E5E7EB] bg-white hover:border-orange-200"
                        } ${savingId != null ? "opacity-70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={locked || savingId != null}
                          onChange={() => onToggle(item)}
                          className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.stageName}</span>

                        {done ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5">
                            {item.docRequired && docs.length > 0 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const target = versionsDocument(docs);
                                    if (target && onOpenDocument) {
                                      onOpenDocument(target);
                                      return;
                                    }
                                    openStageModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-orange-600"
                                  aria-label={
                                    versionsDocument(docs) && onOpenDocument
                                      ? "Open in Document Versions"
                                      : "View or edit note"
                                  }
                                >
                                  <Paperclip className="h-3 w-3" />
                                  <span className="max-w-28 truncate">
                                    {docs.length > 1
                                      ? `${docs.length} files`
                                      : poDocumentDisplayName(docs[0])}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openStageModal(item);
                                  }}
                                  className="inline-flex items-center text-slate-400 hover:text-orange-600"
                                  aria-label="View or edit note"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  openStageModal(item);
                                }}
                                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-orange-600"
                                aria-label="View or edit note"
                              >
                                {item.notes ? (
                                  <StickyNote className="h-3.5 w-3.5" />
                                ) : (
                                  <Pencil className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </span>
                        ) : item.docRequired ? (
                          <FileText
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-label="Document required"
                          />
                        ) : null}

                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
                        ) : (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusPillClass(
                              item.status
                            )}`}
                          >
                            {STATUS_LABEL[item.status ?? "PENDING"]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
              </>
            )}
          </>
        )}
      </WidgetCard>

      {/* Sibling of WidgetCard, not a child — WidgetCard's `.app-card-interactive`
          article uses `hover:-translate-y-0.5`, and an active `transform` on an
          ancestor becomes the containing block for `position: fixed`, which would
          trap this modal inside the card instead of the viewport. */}
      <EditModal
        open={modalStage != null}
        title={`Add note — ${modalStage?.stageName ?? ""}`}
        onClose={() => setModalStage(null)}
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {/* Document is offered on every stage. "No attachment required"
              persists the stage's docRequired flag (its inverse); when a
              document IS required, a file must be attached to complete. */}
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100">
              <input
                type="checkbox"
                checked={draftNotRequired}
                onChange={(e) => {
                  setDraftNotRequired(e.target.checked);
                  if (e.target.checked) setDraftFiles([]);
                }}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
              />
              <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span>No attachment required</span>
            </label>

            {/* "Email attached" read as a statement about the past. This
                checkbox decides something about to happen: whether the files on
                this stage travel with the email that announces it. */}
            {modalStage?.emailAttachmentEnabled ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={draftEmailAttach}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDraftEmailAttach(on);
                    if (on) {
                      setDraftEmailNewIndexes(draftFiles.map((_, i) => i));
                      setDocsExpanded(true);
                      setDocPage(1);
                    } else {
                      setDraftEmailNewIndexes([]);
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                />
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0">
                  Email these attached files
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Only checked documents in the list below are emailed.
                  </span>
                </span>
              </label>
            ) : null}
          </div>

          {!draftNotRequired && isProductionStage && canCreatePo && (
            <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPoMode("upload")}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  poMode === "upload"
                    ? "bg-white text-orange-700 shadow-sm border border-orange-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setPoMode("manual")}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  poMode === "manual"
                    ? "bg-white text-orange-700 shadow-sm border border-orange-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Enter manually
              </button>
            </div>
          )}

          {!draftNotRequired && manualPoActive && (
            <PoManualEntryFields
              details={poDetails}
              onDetailsChange={setPoDetails}
              orderNoEditable
              items={poItems}
              onItemsChange={setPoItems}
            />
          )}

          {!draftNotRequired && !manualPoActive && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">
                Upload document
              </span>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (!picked.length) return;
                  setDraftFiles((prev) => {
                    const added = picked.filter(
                      (f) => !prev.some((p) => p.name === f.name)
                    );
                    const next = [...added, ...prev];
                    if (draftEmailAttach) {
                      setDraftEmailNewIndexes(next.map((_, i) => i));
                    } else if (added.length > 0) {
                      setDraftEmailNewIndexes((indexes) =>
                        indexes.map((i) => i + added.length)
                      );
                    }
                    return next;
                  });
                  setDocsExpanded(true);
                  setDocPage(1);
                  e.target.value = "";
                }}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
              />
              {selectedKey === "production" ? (
                <p className="text-xs text-slate-500">
                  Uploaded POs appear under Document Versions for quote comparison.
                </p>
              ) : selectedKey === "design" ? (
                <p className="text-xs text-slate-500">
                  Uploaded drawings appear under Document Versions.
                </p>
              ) : null}
            </div>
          )}

          {showModalDocList && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setDocsExpanded((open) => !open)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-orange-700"
                  aria-expanded={docsExpanded}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      docsExpanded ? "rotate-0" : "-rotate-90"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-700">
                      Documents
                      <span className="ml-1.5 font-normal text-slate-400">
                        ({modalDocTotal})
                      </span>
                    </span>
                    {!docsExpanded ? (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {draftFiles.length > 0
                          ? `${draftFiles.length} new · click to view all`
                          : draftEmailAttach && selectedEmailCount > 0
                            ? `${selectedEmailCount} selected for email · click to view`
                            : "Click to view and select documents"}
                      </span>
                    ) : null}
                  </span>
                </button>
                {modalStage?.emailAttachmentEnabled && draftEmailAttach ? (
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = modalDocuments
                        .map((d) => d.id)
                        .filter((id): id is number => typeof id === "number");
                      const allSelected =
                        (allIds.length > 0 || draftFiles.length > 0) &&
                        allIds.every((id) => draftEmailDocIds.includes(id)) &&
                        draftFiles.every((_, i) =>
                          draftEmailNewIndexes.includes(i)
                        );
                      if (allSelected) {
                        setDraftEmailDocIds([]);
                        setDraftEmailNewIndexes([]);
                      } else {
                        setDraftEmailDocIds(allIds);
                        setDraftEmailNewIndexes(draftFiles.map((_, i) => i));
                        setDocsExpanded(true);
                        setDocPage(1);
                      }
                    }}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700"
                  >
                    {(modalDocuments.some(
                      (d) => typeof d.id === "number"
                    ) ||
                      draftFiles.length > 0) &&
                    modalDocuments
                      .map((d) => d.id)
                      .filter((id): id is number => typeof id === "number")
                      .every((id) => draftEmailDocIds.includes(id)) &&
                    draftFiles.every((_, i) =>
                      draftEmailNewIndexes.includes(i)
                    )
                      ? "Clear all"
                      : "Attach all"}
                  </button>
                ) : null}
              </div>
              {docsExpanded ? (
                <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
                  <input
                    type="search"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents…"
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-300/60 focus:ring-2 focus:ring-orange-200/40"
                    aria-label="Search documents"
                  />
                  <div className="space-y-1.5">
                    {filteredDocListItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-2 text-xs text-slate-500">
                        No documents match “{docSearch.trim()}”.
                      </p>
                    ) : (
                      pagedDocListItems.map((item) => {
                        if (item.kind === "new") {
                          const { file, index } = item;
                          const emailSelectable =
                            modalStage?.emailAttachmentEnabled === true &&
                            draftEmailAttach;
                          const emailSelected =
                            draftEmailNewIndexes.includes(index);
                          return (
                            <div
                              key={`new-${file.name}-${index}`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700"
                            >
                              <span className="flex min-w-0 items-center gap-1.5">
                                {emailSelectable ? (
                                  <input
                                    type="checkbox"
                                    checked={emailSelected}
                                    onChange={(e) => {
                                      setDraftEmailNewIndexes((prev) =>
                                        e.target.checked
                                          ? prev.includes(index)
                                            ? prev
                                            : [...prev, index]
                                          : prev.filter((i) => i !== index)
                                      );
                                    }}
                                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                                    aria-label={`Email ${file.name}`}
                                  />
                                ) : (
                                  <FileText
                                    className="h-4 w-4 shrink-0 text-slate-400"
                                    aria-hidden
                                  />
                                )}
                                <span className="min-w-0 truncate">
                                  <span className="truncate">{file.name}</span>
                                  <span className="ml-1.5 inline-block rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                                    New
                                  </span>
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftFiles((prev) =>
                                    prev.filter((_, i) => i !== index)
                                  );
                                  setDraftEmailNewIndexes((prev) =>
                                    prev
                                      .filter((i) => i !== index)
                                      .map((i) => (i > index ? i - 1 : i))
                                  );
                                }}
                                className="shrink-0 rounded-md p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove ${file.name}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        }

                        const { doc } = item;
                        const docId =
                          typeof doc.id === "number" ? doc.id : null;
                        const fromProduction =
                          docId != null && !modalOwnDocIds.has(docId);
                        const emailSelectable =
                          modalStage?.emailAttachmentEnabled === true &&
                          draftEmailAttach &&
                          docId != null;
                        const emailSelected =
                          emailSelectable &&
                          draftEmailDocIds.includes(docId);
                        return (
                          <div
                            key={doc.id ?? poDocumentDisplayName(doc)}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700"
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {emailSelectable ? (
                                <input
                                  type="checkbox"
                                  checked={emailSelected}
                                  onChange={(e) => {
                                    setDraftEmailDocIds((prev) =>
                                      e.target.checked
                                        ? prev.includes(docId)
                                          ? prev
                                          : [...prev, docId]
                                        : prev.filter((id) => id !== docId)
                                    );
                                  }}
                                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                                  aria-label={`Email ${poDocumentDisplayName(doc)}`}
                                />
                              ) : (
                                <FileText
                                  className="h-4 w-4 shrink-0 text-slate-400"
                                  aria-hidden
                                />
                              )}
                              <span className="min-w-0 truncate">
                                {onOpenDocument &&
                                (doc.documentType === "PRODUCTION" ||
                                  doc.documentType === "DRAWING") ? (
                                  <button
                                    type="button"
                                    className="truncate text-left hover:text-orange-700"
                                    onClick={() => {
                                      setModalStage(null);
                                      onOpenDocument(doc);
                                    }}
                                  >
                                    {poDocumentDisplayName(doc)}
                                  </button>
                                ) : (
                                  <span className="truncate">
                                    {poDocumentDisplayName(doc)}
                                  </span>
                                )}
                                {fromProduction ? (
                                  <span className="ml-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Production
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            {!fromProduction ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteDocument(
                                    doc.id as number,
                                    doc.documentName
                                  )
                                }
                                disabled={deletingDocId === doc.id}
                                className="shrink-0 rounded-md p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                aria-label={`Delete ${doc.documentName}`}
                              >
                                {deletingDocId === doc.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {filteredDocListItems.length > DOC_PAGE_SIZE ? (
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <p className="text-xs text-slate-500">
                        {(Math.min(docPage, docPageCount) - 1) * DOC_PAGE_SIZE +
                          1}
                        –
                        {Math.min(
                          Math.min(docPage, docPageCount) * DOC_PAGE_SIZE,
                          filteredDocListItems.length
                        )}{" "}
                        of {filteredDocListItems.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={docPage <= 1}
                          onClick={() =>
                            setDocPage((p) => Math.max(1, p - 1))
                          }
                          className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-orange-200 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Previous documents page"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                          Prev
                        </button>
                        <span className="px-1 text-xs text-slate-500">
                          {Math.min(docPage, docPageCount)}/{docPageCount}
                        </span>
                        <button
                          type="button"
                          disabled={docPage >= docPageCount}
                          onClick={() =>
                            setDocPage((p) => Math.min(docPageCount, p + 1))
                          }
                          className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-orange-200 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Next documents page"
                        >
                          Next
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          <ModalField
            label="Remarks (saved to stage note)"
            value={draftRemarks}
            onChange={setDraftRemarks}
            placeholder="e.g. Awaiting client sign-off on mould dimensions."
            multiline
          />

          <button
            className="btn-primary inline-flex w-full items-center justify-center gap-2"
            onClick={() => void saveStageModal()}
            disabled={
              uploading ||
              (modalStage != null && savingId === modalStage.id) ||
              (!draftNotRequired &&
                !modalHadDocument &&
                (manualPoActive
                  ? manualPoLineItemsFromRows(poItems).length === 0
                  : draftFiles.length === 0))
            }
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : modalStage != null && savingId === modalStage.id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save & complete"
            )}
          </button>
        </div>
      </EditModal>
    </>
  );
}
