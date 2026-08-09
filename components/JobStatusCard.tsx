"use client";

import { useEffect, useMemo, useState } from "react";
import { ListChecks, Paperclip } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import {
  buildJobTimelineAnalytics,
  TIMELINE_STAGES,
  type TimelineStageId,
} from "@/lib/jobTimelineAnalytics";
import type { Job } from "@/lib/types";

interface JobStatusCardProps {
  job: Job;
  className?: string;
}

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
 *  inside the proof modal. Every scope is one of the local-only
 *  PREVIEW_ITEMS stages. */
interface ModalItemOption {
  key: string;
  label: string;
}

/** What was attached (or waived) for one checklist item. Purely local —
 *  there is no attachment/remarks endpoint on the server for any stage yet,
 *  so nothing here is sent anywhere. */
interface ProofRecord {
  fileName?: string;
  remarks?: string;
  notRequired: boolean;
}

function proofKey(scope: TimelineStageId, itemKey: string): string {
  return `${scope}-${itemKey}`;
}

export function JobStatusCard({ job, className }: JobStatusCardProps) {
  const timeline = useMemo(() => buildJobTimelineAnalytics(job), [job]);

  // Which stage's checklist the dropdown is currently showing. This is a
  // *view* selection only — nothing is saved by picking a value here, only
  // by ticking a box inside a checklist below.
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
  // as `localChecks`. Local-only, same as everything else on this card.
  const [proofs, setProofs] = useState<Record<string, ProofRecord>>({});

  // --- The "attach proof" modal ---------------------------------------
  // Ticking a box (unchecked -> checked) never ticks it directly — it opens
  // this modal instead, and the box only becomes checked once the modal is
  // saved (with a file, or with "no attachment required" ticked). Unticking
  // an already-checked box skips the modal entirely — see the two onChange
  // handlers below.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalScope, setModalScope] = useState<TimelineStageId>("production");
  const [modalItems, setModalItems] = useState<ModalItemOption[]>([]);
  const [draftItemKey, setDraftItemKey] = useState("");
  const [draftFileName, setDraftFileName] = useState("");
  const [draftRemarks, setDraftRemarks] = useState("");
  const [draftNotRequired, setDraftNotRequired] = useState(false);

  const openProofModal = (
    scope: TimelineStageId,
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

  const checkItem = (scope: TimelineStageId, itemKey: string) => {
    setLocalChecks((prev) => ({ ...prev, [proofKey(scope, itemKey)]: true }));
  };

  const uncheckItem = (scope: TimelineStageId, itemKey: string) => {
    setLocalChecks((prev) => ({ ...prev, [proofKey(scope, itemKey)]: false }));
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
          {/* Design and Approval only ever rendered the drawing checklist,
              which is gone along with its endpoints — they fall through to
              the neutral placeholder below. */}
          {PREVIEW_ITEMS[viewStage] ? (
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
          ) : viewStage === "completed" ? (
            <p className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm text-slate-600">
              {job.status === "Complete" ? "All upstream work is done." : "Not reached yet."}
            </p>
          ) : (
            <p className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm text-slate-600">
              No checklist for this stage.
            </p>
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
