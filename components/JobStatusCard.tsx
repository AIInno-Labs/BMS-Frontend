"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, ListChecks, Loader2, Paperclip, Pencil, StickyNote, X } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { PoManualEntryFields, type PoDetailsFormValue } from "@/components/PoManualEntryFields";
import {
  createManualPoDocument,
  deleteJobDocument,
  listJobStages,
  updateJobStage,
  uploadJobDocument,
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
import { isCancelledJob } from "@/lib/frp/job-status";

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
  const locked = isCancelledJob(job.status);
  const [stages, setStages] = useState<FrpJobStageDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  // The note modal, opened on every stage tick. It always offers the document
  // option; the stage's own `docRequired` decides whether a document is
  // mandatory. When not required, a "No attachment required" toggle is offered.
  const [modalStage, setModalStage] = useState<FrpJobStageDTO | null>(null);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [draftRemarks, setDraftRemarks] = useState("");
  const [draftNotRequired, setDraftNotRequired] = useState(false);
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
      setError(null);
      setStages(await listJobStages(job.dbId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stages");
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
    async (stage: FrpJobStageDTO, body: FrpJobStageUpdateRequest): Promise<boolean> => {
      if (!job.dbId || stage.id == null) return false;
      setSavingId(stage.id);
      try {
        await updateJobStage(job.dbId, stage.id, body);
        await load();
        await onJobChanged?.();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [job.dbId, load, onJobChanged]
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
  const manualPoActive = isProductionStage && poMode === "manual";

  const saveStageModal = async () => {
    if (!modalStage || modalStage.id == null) return;
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
        setError(itemsError);
        return;
      }
    }
    const notes = draftRemarks.trim();
    const stage = modalStage;

    if (manualPoActive) {
      // No file — JSON POST /jobs/{id}/documents/po (best-effort, same as
      // upload: a failed create doesn't block the stage-complete call below).
      if (job.dbId) {
        try {
          await createManualPoDocument(job.dbId, {
            jobStageId: stage.id as number,
            documentName: manualPoDocumentNameFromRows(poDetails.orderNo, poItems),
            orderNo: poDetails.orderNo.trim() || undefined,
            orderDate: poDetails.orderDate.trim() || undefined,
            expectedDate: poDetails.expectedDate.trim() || undefined,
            buyerName: poDetails.buyerName.trim() || undefined,
            quoteNumber: job.quoteNumber?.trim() || undefined,
            currency: poDetails.currency.trim() || undefined,
            remarks: notes,
            lineItems: manualPoLineItemsFromRows(poItems),
          });
          onDocumentsChanged?.();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not add PO");
        }
      }
    } else if (job.dbId && draftFiles.length > 0) {
      // Upload every picked file first (best-effort: a failed upload doesn't
      // block the stage-complete call below — if the stage genuinely requires
      // a document and none made it through, the backend rejects the COMPLETE
      // status and the real error surfaces from `persist`).
      setUploading(true);
      const results = await Promise.allSettled(
        draftFiles.map((file) =>
          uploadJobDocument(job.dbId as string | number, {
            jobStageId: stage.id as number,
            file,
            remarks: notes,
          })
        )
      );
      setUploading(false);
      const uploaded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - uploaded;
      if (failed > 0) {
        setError(
          `${failed} of ${draftFiles.length} document upload${draftFiles.length > 1 ? "s" : ""} failed.`
        );
      }
      if (uploaded > 0) onDocumentsChanged?.();
    }

    // "No attachment required" persists the docRequired flag; note is saved and
    // the stage completes. Keep the modal open (spinner) until it returns.
    const ok = await persist(stage, {
      status: "COMPLETE",
      notes,
      docRequired,
    });
    if (ok) setModalStage(null);
  };

  /** Deletes an already-uploaded document. Purely a document action — it
   *  doesn't touch the stage's own COMPLETE status either way. */
  const handleDeleteDocument = async (docId: number, docName?: string) => {
    if (locked) return;
    if (!window.confirm(`Delete ${docName ?? "this document"}?`)) return;
    setDeletingDocId(docId);
    try {
      await deleteJobDocument(docId);
      // Update the open modal immediately; `load()` keeps the checklist
      // badge (outside the modal) in sync with the same server truth.
      setModalStage((prev) =>
        prev
          ? { ...prev, documents: (prev.documents ?? []).filter((d) => d.id !== docId) }
          : prev
      );
      onDocumentsChanged?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete document");
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
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : milestones.length === 0 ? (
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
                          // emailRequired is backend-only; no UI indicator.
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
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draftNotRequired}
              onChange={(e) => {
                setDraftNotRequired(e.target.checked);
                if (e.target.checked) setDraftFiles([]);
              }}
              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
            />
            No attachment required
          </label>

          {(modalStage?.documents?.length ?? 0) > 0 && (
            <div>
              <span className="block text-sm font-medium text-slate-700">
                Already uploaded
              </span>
              <div className="mt-1 space-y-1.5">
                {modalStage!.documents!.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
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
                        <span className="truncate">{poDocumentDisplayName(doc)}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDocument(doc.id as number, doc.documentName)}
                      disabled={deletingDocId === doc.id}
                      className="shrink-0 rounded-md p-0.5 text-slate-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                      aria-label={`Delete ${doc.documentName}`}
                    >
                      {deletingDocId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!draftNotRequired && isProductionStage && (
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
            <label className="block text-sm font-medium text-slate-700">
              Upload document
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (!picked.length) return;
                  setDraftFiles((prev) => [
                    ...prev,
                    ...picked.filter((f) => !prev.some((p) => p.name === f.name)),
                  ]);
                  // Allow re-picking the same file name after removal.
                  e.target.value = "";
                }}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
              />
              {selectedKey === "production" ? (
                <p className="mt-1.5 text-xs font-normal text-slate-500">
                  Uploaded POs appear under Document Versions for quote comparison.
                </p>
              ) : selectedKey === "design" ? (
                <p className="mt-1.5 text-xs font-normal text-slate-500">
                  Uploaded drawings appear under Document Versions.
                </p>
              ) : null}
              {draftFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {draftFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-normal text-orange-800">
                        <FileText className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{file.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="shrink-0 rounded-md p-0.5 text-orange-600 hover:bg-orange-100"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </label>
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
