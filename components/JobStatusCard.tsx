"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, ListChecks, Loader2, Paperclip, Pencil, StickyNote, X } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { listJobStages, updateJobStage } from "@/lib/frp/api";
import { buildJobTimelineAnalytics } from "@/lib/jobTimelineAnalytics";
import type { FrpJobStageDTO, FrpJobStageUpdateRequest } from "@/lib/frp/job-mapper";
import type { Job } from "@/lib/types";

interface JobStatusCardProps {
  job: Job;
  className?: string;
  /** Called after a stage change persists — lets the parent refetch the job so
   *  the main page (status badge, timeline, %) reflects the new status. */
  onJobChanged?: () => void | Promise<void>;
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
 * What was attached (or waived) when completing a stage that requires a
 * document. Purely local for now — there is no attachment endpoint on the
 * server yet, so the file name / remarks are not persisted; only the stage's
 * COMPLETE status is (via `PUT /jobs/{id}/stages/{stageId}`). Keyed by stage id.
 */
interface ProofRecord {
  fileNames?: string[];
  remarks?: string;
  notRequired: boolean;
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
 * other stage ticks straight through. The upload itself is captured locally
 * until an attachment endpoint exists.
 */
export function JobStatusCard({ job, className, onJobChanged }: JobStatusCardProps) {
  const [stages, setStages] = useState<FrpJobStageDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  // Local-only proof of the doc-required stages that have been completed,
  // keyed by stage id — see ProofRecord.
  const [proofs, setProofs] = useState<Record<number, ProofRecord>>({});

  // The note modal, opened on every stage tick. It always offers the document
  // option; the stage's own `docRequired` decides whether a document is
  // mandatory. When not required, a "No attachment required" toggle is offered.
  const [modalStage, setModalStage] = useState<FrpJobStageDTO | null>(null);
  const [draftFileNames, setDraftFileNames] = useState<string[]>([]);
  const [draftRemarks, setDraftRemarks] = useState("");
  const [draftNotRequired, setDraftNotRequired] = useState(false);

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
  }, [load]);

  // "draft" is intentionally not shown in Status Control — it has no checklist
  // and nothing to action.
  const milestones = useMemo(
    () => (stages ?? []).filter((m) => m.stageKey !== "draft").sort(bySortOrder),
    [stages]
  );

  // Center the dropdown on the job's active stage the first time the tree
  // arrives (and whenever a different job is opened) — the same behaviour the
  // rest of the dashboard uses. Falls back to the first milestone with work.
  useEffect(() => {
    if (!milestones.length) return;
    const active = buildJobTimelineAnalytics(job).activeStageId;
    setSelectedKey((prev) => {
      if (prev && milestones.some((m) => m.stageKey === prev)) return prev;
      const onActive = milestones.find((m) => m.stageKey === active);
      const withWork = milestones.find((m) => (m.children?.length ?? 0) > 0);
      return (onActive ?? withWork ?? milestones[0]).stageKey ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, job.id]);

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
    const existing = stage.id != null ? proofs[stage.id] : undefined;
    setModalStage(stage);
    setDraftFileNames(existing?.fileNames ?? []);
    // Prefill remarks from the local proof if any, else the stage's saved note.
    setDraftRemarks(existing?.remarks ?? stage.notes ?? "");
    // "No attachment required" is the inverse of the stage's docRequired flag.
    setDraftNotRequired(!(stage.docRequired ?? false));
  };

  const onToggle = (stage: FrpJobStageDTO) => {
    if (savingId != null) return;
    if (stage.status === "COMPLETE") {
      // Unticking clears any local proof and reverts the stage.
      if (stage.id != null) {
        setProofs((prev) => {
          const nextProofs = { ...prev };
          delete nextProofs[stage.id as number];
          return nextProofs;
        });
      }
      void persist(stage, { status: "PENDING" });
      return;
    }
    // Ticking always opens the card — the user can add a remark (saved as the
    // stage note), plus a document when the stage requires one.
    openStageModal(stage);
  };

  const saveStageModal = async () => {
    if (!modalStage || modalStage.id == null) return;
    // A document is required unless "No attachment required" is ticked; when
    // required, a file must be chosen to complete.
    const docRequired = !draftNotRequired;
    if (docRequired && draftFileNames.length === 0) return;
    const notes = draftRemarks.trim() || undefined;
    const stage = modalStage;
    // Remember what was attached / waived (local only - no attachment endpoint).
    setProofs((prev) => ({
      ...prev,
      [stage.id as number]: {
        fileNames: draftFileNames.length ? draftFileNames : undefined,
        remarks: notes,
        notRequired: draftNotRequired,
      },
    }));
    // "No attachment required" persists the docRequired flag; note is saved and
    // the stage completes. Keep the modal open (spinner) until it returns.
    const ok = await persist(stage, {
      status: "COMPLETE",
      notes,
      docRequired,
    });
    if (ok) setModalStage(null);
  };

  return (
    <>
      <WidgetCard title="Status Control" icon={ListChecks} className={className}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-2.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Current status
          </span>
          <span className="text-sm font-semibold text-orange-700">{job.status}</span>
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
                    const proof = item.id != null ? proofs[item.id] : undefined;
                    return (
                      <label
                        key={item.id ?? item.stageKey}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                          done
                            ? "border-green-200 bg-green-50/50"
                            : "border-[#E5E7EB] bg-white hover:border-orange-200"
                        } ${savingId != null ? "opacity-70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={savingId != null}
                          onChange={() => onToggle(item)}
                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.stageName}</span>

                        {done ? (
                          // A completed stage is re-openable to view/edit its
                          // note (and document proof, when doc-required).
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              openStageModal(item);
                            }}
                            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-orange-600"
                            aria-label="View or edit note"
                          >
                            {item.docRequired && proof ? (
                              proof.notRequired ? (
                                "N/A"
                              ) : (
                                <>
                                  <Paperclip className="h-3 w-3" />
                                  <span className="max-w-[7rem] truncate">
                                    {proof.fileNames && proof.fileNames.length > 1
                                      ? `${proof.fileNames.length} files`
                                      : proof.fileNames?.[0]}
                                  </span>
                                </>
                              )
                            ) : item.notes ? (
                              <StickyNote className="h-3.5 w-3.5" />
                            ) : (
                              <Pencil className="h-3.5 w-3.5" />
                            )}
                          </button>
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
                      </label>
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
        <div className="space-y-3">
          {/* Document is offered on every stage. "No attachment required"
              persists the stage's docRequired flag (its inverse); when a
              document IS required, a file must be attached to complete. */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draftNotRequired}
              onChange={(e) => {
                setDraftNotRequired(e.target.checked);
                if (e.target.checked) setDraftFileNames([]);
              }}
              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
            />
            No attachment required
          </label>

          {!draftNotRequired && (
            <label className="block text-sm font-medium text-slate-700">
              Upload document
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []).map((f) => f.name);
                  if (!picked.length) return;
                  setDraftFileNames((prev) => [
                    ...prev,
                    ...picked.filter((name) => !prev.includes(name)),
                  ]);
                  // Allow re-picking the same file name after removal.
                  e.target.value = "";
                }}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
              />
              {draftFileNames.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {draftFileNames.map((name, index) => (
                    <div
                      key={`${name}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-normal text-orange-800">
                        <FileText className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftFileNames((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="shrink-0 rounded-md p-0.5 text-orange-600 hover:bg-orange-100"
                        aria-label={`Remove ${name}`}
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
            placeholder="Any context for this stage…"
            multiline
          />

          <button
            className="btn-primary inline-flex w-full items-center justify-center gap-2"
            onClick={() => void saveStageModal()}
            disabled={
              (modalStage != null && savingId === modalStage.id) ||
              (!draftNotRequired && draftFileNames.length === 0)
            }
          >
            {modalStage != null && savingId === modalStage.id ? (
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
