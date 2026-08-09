"use client";

import { useEffect, useState } from "react";
import { FileStack, Paperclip } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import type { Job } from "@/lib/types";

/**
 * Shared review state for both document types below. "pending" only means
 * something for entries that actually have a difference to review (a PO
 * variance, or a drawing revision with changes) — see the banner logic in
 * each section for how that's decided.
 */
type ReviewStatus = "pending" | "approved" | "rejected";

/* ============================================================ Purchase Orders */

interface PoVersion {
  id: string;
  versionLabel: string; // "v1", "v2", ...
  receivedDate: string; // yyyy-mm-dd
  fileName: string;
  quoteQty: number;
  quotePrice: number;
  quoteScope: string;
  poQty: number;
  poPrice: number;
  poScope: string;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedDate?: string;
}

/** Mock data — stands in for what a real "list PO versions" API would return. */
function defaultMockPoVersions(): PoVersion[] {
  return [
    {
      id: "v1",
      versionLabel: "v1",
      receivedDate: "2026-07-14",
      fileName: "PO-5001-v1.pdf",
      quoteQty: 100,
      quotePrice: 500000,
      quoteScope: "Standard walkway grating",
      poQty: 100,
      poPrice: 500000,
      poScope: "Standard walkway grating",
      reviewStatus: "approved",
    },
    {
      id: "v2",
      versionLabel: "v2",
      receivedDate: "2026-07-22",
      fileName: "PO-5001-v2.pdf",
      quoteQty: 100,
      quotePrice: 500000,
      quoteScope: "Standard walkway grating",
      poQty: 120,
      poPrice: 500000,
      poScope: "Standard walkway grating",
      reviewStatus: "approved",
      reviewedBy: "Dana Whitfield",
      reviewedDate: "2026-07-23",
    },
    {
      id: "v3",
      versionLabel: "v3",
      receivedDate: "2026-08-05",
      fileName: "PO-5001-v3.pdf",
      quoteQty: 100,
      quotePrice: 500000,
      quoteScope: "Standard walkway grating",
      poQty: 120,
      poPrice: 512000,
      poScope: "Standard walkway grating + handrail extension",
      reviewStatus: "pending",
    },
  ];
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-AU")}`;
}

interface FieldDiff {
  label: string;
  quoteValue: string;
  poValue: string;
  differs: boolean;
}

function diffPoFields(v: PoVersion): FieldDiff[] {
  return [
    {
      label: "Quantity",
      quoteValue: `${v.quoteQty} units`,
      poValue: `${v.poQty} units`,
      differs: v.quoteQty !== v.poQty,
    },
    {
      label: "Price",
      quoteValue: fmtMoney(v.quotePrice),
      poValue: fmtMoney(v.poPrice),
      differs: v.quotePrice !== v.poPrice,
    },
    {
      label: "Scope",
      quoteValue: v.quoteScope,
      poValue: v.poScope,
      differs: v.quoteScope.trim() !== v.poScope.trim(),
    },
  ];
}

/* =============================================================== Drawings */

interface DrawingRevision {
  id: string;
  revisionLabel: string; // "Rev A", "Rev B", ...
  issuedDate: string;
  fileName: string;
  issuedBy: string;
  /** What changed vs. the previous revision. Empty on the first revision —
   *  there is nothing before it to compare against. */
  changes: string[];
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedDate?: string;
}

/** Mock data. File names follow the same "GA-drawing-Rev*.pdf" convention
 *  already used in the seed data for other jobs. */
function defaultMockDrawingRevisions(): DrawingRevision[] {
  return [
    {
      id: "revA",
      revisionLabel: "Rev A",
      issuedDate: "2026-07-10",
      fileName: "GA-drawing-RevA.pdf",
      issuedBy: "Engineering — S. Patel",
      changes: [],
      reviewStatus: "approved",
    },
    {
      id: "revB",
      revisionLabel: "Rev B",
      issuedDate: "2026-07-18",
      fileName: "GA-drawing-RevB.pdf",
      issuedBy: "Engineering — S. Patel",
      changes: [
        "Mesh size changed from 50×50mm to 40×40mm per client request",
        "Stanchion spacing corrected to 900mm centres",
      ],
      reviewStatus: "approved",
      reviewedBy: "Dana Whitfield",
      reviewedDate: "2026-07-19",
    },
    {
      id: "revC",
      revisionLabel: "Rev C",
      issuedDate: "2026-07-29",
      fileName: "GA-drawing-RevC.pdf",
      issuedBy: "Engineering — S. Patel",
      changes: [
        "Added handrail mounting bracket detail (Detail C)",
        "Overall length dimension updated to 6400mm",
      ],
      reviewStatus: "pending",
    },
  ];
}

// ---------------------------------------------------------------------------
// localStorage stand-in for real Purchase Order and Drawing Revision APIs.
//
// Neither has a backend yet — no tables, no endpoints. So both document
// types are saved into the browser's own localStorage, under keys scoped to
// the job's id, the same trick this dashboard's other cards already use for
// the "Project documents" file list and the chat notes (see
// JobWorkflowDashboard.tsx's `loadFiles` / `frp-files-${job.id}`). The first
// time a job is opened there's nothing saved yet, so each seeds in its own
// mock data above — again, the same trick `defaultDemoFiles()` uses for
// Project Documents.
//
// This means: it looks and behaves like a real save (survives a refresh),
// but it only exists in *this* browser, on *this* computer.
//
// FOR THE DEVELOPER WIRING UP THE REAL APIS:
// Once real endpoints exist for Purchase Orders (e.g.
// `GET /jobs/{id}/purchase-orders`, `.../signoff`) and for Drawing revisions
// (e.g. `GET /jobs/{id}/drawing-revisions`, `.../review`), replace the four
// load/save functions below with real network calls, delete the two
// `defaultMock...` functions, and remove this comment block. Nothing else in
// this component should need to change shape — the rest of the file only
// ever calls these four functions.
// ---------------------------------------------------------------------------
function poStorageKey(jobId: string): string {
  return `frp-purchase-orders-${jobId}`;
}
function drawingRevisionStorageKey(jobId: string): string {
  return `frp-drawing-revisions-${jobId}`;
}

function loadPoVersions(jobId: string): PoVersion[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(poStorageKey(jobId));
  if (!raw) return defaultMockPoVersions();
  try {
    const parsed = JSON.parse(raw) as PoVersion[];
    return Array.isArray(parsed) && parsed.length ? parsed : defaultMockPoVersions();
  } catch {
    return defaultMockPoVersions();
  }
}
function savePoVersions(jobId: string, versions: PoVersion[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(poStorageKey(jobId), JSON.stringify(versions));
}

function loadDrawingRevisions(jobId: string): DrawingRevision[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(drawingRevisionStorageKey(jobId));
  if (!raw) return defaultMockDrawingRevisions();
  try {
    const parsed = JSON.parse(raw) as DrawingRevision[];
    return Array.isArray(parsed) && parsed.length ? parsed : defaultMockDrawingRevisions();
  } catch {
    return defaultMockDrawingRevisions();
  }
}
function saveDrawingRevisions(jobId: string, revisions: DrawingRevision[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(drawingRevisionStorageKey(jobId), JSON.stringify(revisions));
}
// --------------------------------------------------------------- end stand-in

function ReviewActions({
  status,
  reviewedBy,
  reviewedDate,
  onApprove,
  onReject,
}: {
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedDate?: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (status === "approved") {
    return (
      <span className="text-xs text-slate-500">
        Approved by {reviewedBy} · {reviewedDate}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="text-xs text-slate-500">
        Rejected by {reviewedBy} · {reviewedDate}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onApprove}
        className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={onReject}
        className="inline-flex items-center rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
      >
        Reject
      </button>
    </div>
  );
}

interface JobDocumentRevisionsCardProps {
  job: Job;
  className?: string;
}

export function JobDocumentRevisionsCard({ job, className }: JobDocumentRevisionsCardProps) {
  const [docType, setDocType] = useState<"po" | "drawing">("po");

  /* ---------------------------------------------------------------- Purchase Orders state */
  const [poVersions, setPoVersions] = useState<PoVersion[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPoVersions(job.id);
    setPoVersions(loaded);
    setSelectedPoId(loaded.length ? loaded[loaded.length - 1].id : null);
  }, [job.id]);
  useEffect(() => {
    savePoVersions(job.id, poVersions);
  }, [job.id, poVersions]);

  const selectedPo = poVersions.find((v) => v.id === selectedPoId) ?? null;

  const setPoReview = (status: ReviewStatus) => {
    if (!selectedPo) return;
    setPoVersions((prev) =>
      prev.map((v) =>
        v.id === selectedPo.id
          ? {
              ...v,
              reviewStatus: status,
              reviewedBy: "You",
              reviewedDate: new Date().toISOString().slice(0, 10),
            }
          : v
      )
    );
  };

  /* ---------------------------------------------------------------- Drawing revisions state */
  const [drawingRevisions, setDrawingRevisions] = useState<DrawingRevision[]>([]);
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadDrawingRevisions(job.id);
    setDrawingRevisions(loaded);
    setSelectedRevId(loaded.length ? loaded[loaded.length - 1].id : null);
  }, [job.id]);
  useEffect(() => {
    saveDrawingRevisions(job.id, drawingRevisions);
  }, [job.id, drawingRevisions]);

  const selectedRev = drawingRevisions.find((r) => r.id === selectedRevId) ?? null;

  const setRevReview = (status: ReviewStatus) => {
    if (!selectedRev) return;
    setDrawingRevisions((prev) =>
      prev.map((r) =>
        r.id === selectedRev.id
          ? {
              ...r,
              reviewStatus: status,
              reviewedBy: "You",
              reviewedDate: new Date().toISOString().slice(0, 10),
            }
          : r
      )
    );
  };

  return (
    <WidgetCard title="Document Versions" icon={FileStack} className={className}>
      <div className="mb-3 inline-flex rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setDocType("po")}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            docType === "po"
              ? "bg-white text-orange-700 shadow-sm border border-orange-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Purchase Orders
        </button>
        <button
          type="button"
          onClick={() => setDocType("drawing")}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            docType === "drawing"
              ? "bg-white text-orange-700 shadow-sm border border-orange-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Drawings
        </button>
      </div>

      {docType === "po" ? (
        poVersions.length === 0 || !selectedPo ? (
          <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-3 py-4 text-center text-sm text-slate-500">
            No purchase orders linked to this job yet.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Version
              <select
                value={selectedPo.id}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-normal normal-case text-[#111827]"
              >
                {poVersions
                  .slice()
                  .reverse()
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.versionLabel} · {v.receivedDate}
                      {v.id === poVersions[poVersions.length - 1].id ? " (latest)" : ""}
                    </option>
                  ))}
              </select>
            </label>

            {(() => {
              const diffs = diffPoFields(selectedPo);
              const anyDiff = diffs.some((d) => d.differs);
              const changedLabels = diffs.filter((d) => d.differs).map((d) => d.label).join(", ");
              let bannerClass = "border-emerald-200 bg-emerald-50 text-emerald-700";
              let bannerText = "Matches the accepted quote — no review needed.";
              if (anyDiff) {
                if (selectedPo.reviewStatus === "approved") {
                  bannerClass = "border-amber-200 bg-amber-50 text-amber-900";
                  bannerText = `Variance in ${changedLabels} — reviewed & approved.`;
                } else if (selectedPo.reviewStatus === "rejected") {
                  bannerClass = "border-red-300 bg-red-100 text-red-800";
                  bannerText = `Variance in ${changedLabels} — rejected, needs a corrected PO.`;
                } else {
                  bannerClass = "border-red-200 bg-red-50 text-red-700";
                  bannerText = `Variance detected in ${changedLabels} — needs review.`;
                }
              }
              return (
                <p className={`rounded-lg border px-3 py-2 text-sm font-medium ${bannerClass}`}>
                  {bannerText}
                </p>
              );
            })()}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="pb-1 pr-2 font-semibold">Field</th>
                    <th className="pb-1 pr-2 font-semibold">Quote</th>
                    <th className="pb-1 font-semibold">This PO</th>
                  </tr>
                </thead>
                <tbody>
                  {diffPoFields(selectedPo).map((d) => (
                    <tr key={d.label} className="border-t border-[#EEF1F4]">
                      <td className="py-1.5 pr-2 font-semibold text-slate-700">{d.label}</td>
                      <td className="py-1.5 pr-2 text-slate-600">{d.quoteValue}</td>
                      <td
                        className={`py-1.5 font-medium ${d.differs ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {d.poValue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                {selectedPo.fileName}
              </span>
            </div>

            {diffPoFields(selectedPo).some((d) => d.differs) && (
              <div className="flex items-center justify-end">
                <ReviewActions
                  status={selectedPo.reviewStatus}
                  reviewedBy={selectedPo.reviewedBy}
                  reviewedDate={selectedPo.reviewedDate}
                  onApprove={() => setPoReview("approved")}
                  onReject={() => setPoReview("rejected")}
                />
              </div>
            )}
          </div>
        )
      ) : drawingRevisions.length === 0 || !selectedRev ? (
        <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-3 py-4 text-center text-sm text-slate-500">
          No drawing revisions recorded for this job yet.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Revision
            <select
              value={selectedRev.id}
              onChange={(e) => setSelectedRevId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-normal normal-case text-[#111827]"
            >
              {drawingRevisions
                .slice()
                .reverse()
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.revisionLabel} · {r.issuedDate}
                    {r.id === drawingRevisions[drawingRevisions.length - 1].id ? " (latest)" : ""}
                  </option>
                ))}
            </select>
          </label>

          {(() => {
            const hasChanges = selectedRev.changes.length > 0;
            let bannerClass = "border-slate-200 bg-slate-50 text-slate-600";
            let bannerText = "Initial issue — no prior revision to compare.";
            if (hasChanges) {
              if (selectedRev.reviewStatus === "approved") {
                bannerClass = "border-amber-200 bg-amber-50 text-amber-900";
                bannerText = "Changes reviewed & approved.";
              } else if (selectedRev.reviewStatus === "rejected") {
                bannerClass = "border-red-300 bg-red-100 text-red-800";
                bannerText = "Changes rejected — needs a corrected revision.";
              } else {
                bannerClass = "border-red-200 bg-red-50 text-red-700";
                bannerText = "Changes pending review.";
              }
            }
            return (
              <p className={`rounded-lg border px-3 py-2 text-sm font-medium ${bannerClass}`}>
                {bannerText}
              </p>
            );
          })()}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              What changed vs. the previous revision
            </p>
            {selectedRev.changes.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Nothing to compare — this is the first revision.</p>
            ) : (
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-slate-700">
                {selectedRev.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
              {selectedRev.fileName}
            </span>
            <span className="text-xs text-slate-500">{selectedRev.issuedBy}</span>
          </div>

          {selectedRev.changes.length > 0 && (
            <div className="flex items-center justify-end">
              <ReviewActions
                status={selectedRev.reviewStatus}
                reviewedBy={selectedRev.reviewedBy}
                reviewedDate={selectedRev.reviewedDate}
                onApprove={() => setRevReview("approved")}
                onReject={() => setRevReview("rejected")}
              />
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
