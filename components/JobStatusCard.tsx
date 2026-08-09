"use client";

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Paperclip } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { formatCreatedDate } from "@/lib/mockData";
import {
  buildJobTimelineAnalytics,
  TIMELINE_STAGES,
  type TimelineStageId,
} from "@/lib/jobTimelineAnalytics";
import type { FrpDrawingStage, FrpDrawingStageDTO } from "@/lib/frp/job-mapper";
import type { Job } from "@/lib/types";

interface JobStatusCardProps {
  job: Job;
  /** Owned by JobWorkflowDashboard — same state, same fetch, same PUT call
   *  it already used when Drawing was its own card. Nothing about how these
   *  five boxes save changed, they just render from here now. */
  drawingStages: FrpDrawingStageDTO[];
  drawingBusy: FrpDrawingStage | null;
  drawingError: string | null;
  onDrawingToggle: (stage: FrpDrawingStage, checked: boolean) => Promise<void> | void;
  drawingDoneCount: number;
  className?: string;
}

/** The two Drawing keys the backend actually watches for "Approval". There is
 *  no separate Approval checklist anywhere — the Approval view below just
 *  re-renders these two entries from `drawingStages` read-only. This mirrors
 *  handleDrawingToggle's own condition in JobWorkflowDashboard, so it can
 *  never disagree with it. */
const APPROVAL_KEYS: FrpDrawingStage[] = ["ENGINEER_APPROVED", "CLIENT_APPROVED"];

/** Dropdown options. "Draft" is intentionally excluded — it has no checklist
 *  and nothing to interact with, so it isn't offered as a view. */
const SELECTABLE_STAGES = TIMELINE_STAGES.filter((s) => s.id !== "draft");

/**
 * Local-only preview checklists for Production / QC / Dispatch.
 *
 * Production's three real operations (mould/layup/cure) and the QC/Dispatch
 * milestones already exist on the backend, but there is no endpoint wired up
 * on the frontend for any of them yet, and QC/Dispatch have no checklist
 * items on the server at all. So these render as tickable boxes so the
 * design can be evaluated end-to-end, but ticking one only flips local
 * component state — it is never saved anywhere and resets on refresh. There
 * is deliberately no on-screen label calling this out; that explanation
 * belongs here, not in the UI.
 *
 * TODO(real API): once `PUT /jobs/{id}/stages/{stageId}` is wired up here,
 * replace `localChecks` below with state fetched from `GET /jobs/{id}/stages`
 * and have the checkbox onChange call that PUT instead of `toggleLocal`.
 */
const PREVIEW_ITEMS: Partial<Record<TimelineStageId, { key: string; label: string }[]>> = {
  production: [
    { key: "mould", label: "Mould prep" },
    { key: "layup", label: "Lay-up" },
    { key: "cure", label: "Cure & trim" },
  ],
  qc: [
    { key: "visual", label: "Visual inspection" },
    { key: "dimensional", label: "Dimensional check" },
    { key: "signoff", label: "QA sign-off" },
  ],
  dispatch: [
    { key: "packed", label: "Packed for freight" },
    { key: "photographed", label: "Photographed" },
    { key: "shipped", label: "Handed to carrier" },
  ],
};

/** A single item a checkbox can point at, for the "status step" select
 *  inside the proof modal. `scope` says which bucket it saves through:
 *  "design" goes through the real `onDrawingToggle`, anything else is one
 *  of the local-only PREVIEW_ITEMS stages. */
interface ModalItemOption {
  key: string;
  label: string;
}

/** What was attached (or waived) for one checklist item. Purely local —
 *  there is no attachment/remarks endpoint on the server for any stage yet,
 *  Drawing included, so nothing here is sent anywhere. */
interface ProofRecord {
  fileName?: string;
  remarks?: string;
  notRequired: boolean;
}

function proofKey(scope: "design" | TimelineStageId, itemKey: string): string {
  return `${scope}-${itemKey}`;
}

export function JobStatusCard({
  job,
  drawingStages,
  drawingBusy,
  drawingError,
  onDrawingToggle,
  drawingDoneCount,
  className,
}: JobStatusCardProps) {
  const timeline = useMemo(
    () => buildJobTimelineAnalytics(job, drawingDoneCount),
    [job, drawingDoneCount]
  );

  // Which stage's checklist the dropdown is currently showing. This is a
  // *view* selection only — nothing is saved by picking a value here, only
  // by ticking a box inside the checklist below.
  const [viewStage, setViewStage] = useState<TimelineStageId>(
    timeline.activeStageId === "draft" ? "design" : timeline.activeStageId
  );
  useEffect(() => {
    // Re-center on the job's real current stage whenever a different job is
    // opened, same pattern the rest of this dashboard already uses. "draft"
    // is not a selectable option (see SELECTABLE_STAGES), so it falls back
    // to "design".
    setViewStage(timeline.activeStageId === "draft" ? "design" : timeline.activeStageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // Non-persisted placeholder state for Production / QC / Dispatch — see the
  // TODO on PREVIEW_ITEMS above.
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({});

  // What's been attached to each item that's been ticked, keyed the same way
  // as `localChecks`/`design-<stage>`. Local-only, same as everything else
  // on this card that isn't Drawing's own real save.
  const [proofs, setProofs] = useState<Record<string, ProofRecord>>({});

  // --- The "attach proof" modal ---------------------------------------
  // Ticking a box (unchecked -> checked) never ticks it directly — it opens
  // this modal instead, and the box only becomes checked once the modal is
  // saved (with a file, or with "no attachment required" ticked). Unticking
  // an already-checked box skips the modal entirely — see the two onChange
  // handlers below.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalScope, setModalScope] = useState<"design" | TimelineStageId>("design");
  const [modalItems, setModalItems] = useState<ModalItemOption[]>([]);
  const [draftItemKey, setDraftItemKey] = useState("");
  const [draftFileName, setDraftFileName] = useState("");
  const [draftRemarks, setDraftRemarks] = useState("");
  const [draftNotRequired, setDraftNotRequired] = useState(false);

  const openProofModal = (
    scope: "design" | TimelineStageId,
    itemKey: string,
    items: ModalItemOption[]
  ) => {
    const existing = proofs[proofKey(scope, itemKey)];
    setModalScope(scope);
    setModalItems(items);
    setDraftItemKey(itemKey);
    setDraftFileName(existing?.fileName ?? "");
    setDraftRemarks(existing?.remarks ?? "");
    setDraftNotRequired(existing?.notRequired ?? false);
    setModalOpen(true);
  };

  const checkItem = (scope: "design" | TimelineStageId, itemKey: string) => {
    if (scope === "design") {
      void onDrawingToggle(itemKey as FrpDrawingStage, true);
    } else {
      setLocalChecks((prev) => ({ ...prev, [proofKey(scope, itemKey)]: true }));
    }
  };

  const uncheckItem = (scope: "design" | TimelineStageId, itemKey: string) => {
    if (scope === "design") {
      void onDrawingToggle(itemKey as FrpDrawingStage, false);
    } else {
      setLocalChecks((prev) => ({ ...prev, [proofKey(scope, itemKey)]: false }));
    }
    // Unticking clears whatever was attached — the item is no longer marked
    // complete, so there's nothing current to show proof of.
    setProofs((prev) => {
      const next = { ...prev };
      delete next[proofKey(scope, itemKey)];
      return next;
    });
  };

  const saveProofModal = () => {
    if (!draftNotRequired && !draftFileName.trim()) return;
    setProofs((prev) => ({
      ...prev,
      [proofKey(modalScope, draftItemKey)]: {
        fileName: draftNotRequired ? undefined : draftFileName.trim(),
        remarks: draftRemarks.trim() || undefined,
        notRequired: draftNotRequired,
      },
    }));
    checkItem(modalScope, draftItemKey);
    setModalOpen(false);
  };

  const drawingItemOptions: ModalItemOption[] = drawingStages.map((s) => ({
    key: s.stage,
    label: s.label ?? s.stage,
  }));

  return (
    <>
      <WidgetCard title="Status Control" icon={ListChecks} className={className}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-2.5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Current status
          </span>
          <span className="text-sm font-semibold text-orange-700">{job.status}</span>
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          View checklist for
          <select
            value={viewStage}
            onChange={(e) => setViewStage(e.target.value as TimelineStageId)}
            className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-normal normal-case text-[#111827]"
          >
            {SELECTABLE_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3">
          {viewStage === "design" && (
            <div className="space-y-2">
              {drawingStages.map((item) => {
                const proof = proofs[proofKey("design", item.stage)];
                return (
                  <label
                    key={item.stage}
                    title={
                      item.completed && item.updatedAt
                        ? `Ticked ${formatCreatedDate(item.updatedAt)}`
                        : undefined
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm hover:border-orange-200"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={drawingBusy !== null}
                      onChange={(e) =>
                        e.target.checked
                          ? openProofModal("design", item.stage, drawingItemOptions)
                          : uncheckItem("design", item.stage)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300 disabled:opacity-50"
                    />
                    {item.label ?? item.stage}
                    {item.completed && proof && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          openProofModal("design", item.stage, drawingItemOptions);
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-orange-600"
                      >
                        {proof.notRequired ? (
                          "N/A"
                        ) : (
                          <>
                            <Paperclip className="h-3 w-3" />
                            {proof.fileName}
                          </>
                        )}
                      </button>
                    )}
                  </label>
                );
              })}
              {drawingError && (
                <p className="col-span-full text-xs text-red-600">{drawingError}</p>
              )}
            </div>
          )}

          {/* Approval has no checklist of its own on the server — it is
              gated by the same two Drawing boxes (ENGINEER_APPROVED /
              CLIENT_APPROVED). Rendered here read-only, reusing the live
              `drawingStages` data, so it can never disagree with Drawing's
              own view of the same two items. */}
          {viewStage === "approval" && (
            <div className="space-y-2">
              {drawingStages
                .filter((item) => APPROVAL_KEYS.includes(item.stage))
                .map((item) => (
                  <label
                    key={item.stage}
                    className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] px-2.5 py-2 text-sm text-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 disabled:opacity-70"
                    />
                    {item.label ?? item.stage}
                  </label>
                ))}
            </div>
          )}

          {viewStage === "completed" && (
            <p className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm text-slate-600">
              {job.status === "Complete" ? "All upstream work is done." : "Not reached yet."}
            </p>
          )}

          {PREVIEW_ITEMS[viewStage] && (
            <div className="space-y-2">
              {PREVIEW_ITEMS[viewStage]!.map((item) => {
                const checkKey = proofKey(viewStage, item.key);
                const checked = Boolean(localChecks[checkKey]);
                const proof = proofs[checkKey];
                return (
                  <label
                    key={checkKey}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-white px-2.5 py-2 text-sm hover:border-orange-200"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        e.target.checked
                          ? openProofModal(viewStage, item.key, PREVIEW_ITEMS[viewStage]!)
                          : uncheckItem(viewStage, item.key)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-300"
                    />
                    {item.label}
                    {checked && proof && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          openProofModal(viewStage, item.key, PREVIEW_ITEMS[viewStage]!);
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-orange-600"
                      >
                        {proof.notRequired ? (
                          "N/A"
                        ) : (
                          <>
                            <Paperclip className="h-3 w-3" />
                            {proof.fileName}
                          </>
                        )}
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </WidgetCard>

      {/* Rendered as a sibling of WidgetCard, not a child of it. WidgetCard's
          `.app-card-interactive` article has `hover:-translate-y-0.5` — any
          active `transform` on an ancestor becomes the containing block for
          `position: fixed` descendants, which trapped this modal inside the
          card's box instead of the real viewport whenever the cursor was
          resting on the card. Every other modal in this app is already a
          sibling of its card for the same reason. */}
      <EditModal open={modalOpen} title="Attach approval / proof document" onClose={() => setModalOpen(false)}>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Status step
            <select
              value={draftItemKey}
              onChange={(e) => setDraftItemKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
            >
              {modalItems.map((it) => (
                <option key={it.key} value={it.key}>
                  {it.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draftNotRequired}
              onChange={(e) => {
                setDraftNotRequired(e.target.checked);
                if (e.target.checked) setDraftFileName("");
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
                onChange={(e) => setDraftFileName(e.target.files?.[0]?.name ?? "")}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
              />
            </label>
          )}

          <ModalField
            label="Remarks (optional)"
            value={draftRemarks}
            onChange={setDraftRemarks}
            placeholder="Any context for this approval…"
            multiline
          />

          <button
            className="btn-primary w-full"
            onClick={saveProofModal}
            disabled={!draftNotRequired && !draftFileName.trim()}
          >
            Save
          </button>
        </div>
      </EditModal>
    </>
  );
}
