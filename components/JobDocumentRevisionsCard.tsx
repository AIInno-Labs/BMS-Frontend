"use client";

import { useCallback, useEffect, useState } from "react";
import { FileStack, Loader2, Paperclip, Pencil } from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { useAuth } from "@/context/AuthContext";
import {
  compareJobDocument,
  downloadJobDocument,
  listJobDocuments,
  listUsers,
  updateJobDocument,
} from "@/lib/frp/api";
import type {
  FrpDocumentStatus,
  FrpJobDocumentDTO,
  FrpPoComparisonDTO,
} from "@/lib/frp/job-mapper";
import type { Job } from "@/lib/types";

type ReviewStatus = "pending" | "approved" | "rejected";
type DocTab = "po" | "drawing";

function toReviewStatus(status?: FrpDocumentStatus): ReviewStatus {
  if (status === "ACCEPTED") return "approved";
  if (status === "REJECTED") return "rejected";
  return "pending";
}

function fromReviewStatus(status: ReviewStatus): FrpDocumentStatus {
  if (status === "approved") return "ACCEPTED";
  if (status === "rejected") return "REJECTED";
  return "ACTIVE";
}

function versionOptionLabel(doc: FrpJobDocumentDTO, latestId: number | null): string {
  const ver = doc.documentVersion != null ? `v${doc.documentVersion}` : "v?";
  const name = doc.documentName?.trim() || "Untitled";
  const latest = doc.id != null && doc.id === latestId ? " (latest)" : "";
  return `${ver} · ${name}${latest}`;
}

function sortByVersionDesc(docs: FrpJobDocumentDTO[]): FrpJobDocumentDTO[] {
  return [...docs].sort((a, b) => {
    const av = a.documentVersion ?? 0;
    const bv = b.documentVersion ?? 0;
    if (bv !== av) return bv - av;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asMapList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
}

/** Build `editedDocumentData` from the simple qty / price / scope edit form. */
function buildEditedPoData(
  base: Record<string, unknown> | null | undefined,
  poQty: number,
  poPrice: number,
  poScope: string
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(base ?? {}) };
  const lines = asMapList(next.lineItems);
  const first = lines[0] ? { ...lines[0] } : {};
  first.quantity = poQty;
  first.description = poScope;
  next.lineItems = [first];

  const totals = { ...asRecord(next.totals) };
  totals.amountAfterTax = poPrice;
  next.totals = totals;
  return next;
}

/** Preserve pointwise Scope text from compare (`\r\n`, `* ` bullets). */
function ComparisonValue({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const text = (value ?? "—").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return <span className={`whitespace-pre-line ${className ?? ""}`}>{text}</span>;
}

/**
 * Normalize compare Price strings for display as `{CODE} {amount}` when the
 * currency is known (from extract totals, or inferred from symbols like A$).
 * If currency is unknown, keep the API value as-is — never invent AUD.
 */
function inferCurrencyFromMoneyText(raw: string): string | null {
  const t = raw.trim();
  if (/^A\$/i.test(t) || /\bAUD\b/i.test(t)) return "AUD";
  if (/^US\$/i.test(t) || /\bUSD\b/i.test(t)) return "USD";
  if (/^NZ\$/i.test(t) || /\bNZD\b/i.test(t)) return "NZD";
  if (/^CA\$/i.test(t) || /\bCAD\b/i.test(t)) return "CAD";
  if (/^£/.test(t) || /\bGBP\b/i.test(t)) return "GBP";
  if (/^€/.test(t) || /\bEUR\b/i.test(t)) return "EUR";
  // India
  if (/^₹/.test(t) || /^Rs\.?\s?/i.test(t) || /\bINR\b/i.test(t)) return "INR";
  // Saudi Arabia / Gulf
  if (
    /^﷼/.test(t) ||
    /^SR\.?\s?/i.test(t) ||
    /\bSAR\b/i.test(t) ||
    /\briyal\b/i.test(t)
  ) {
    return "SAR";
  }
  if (/^د\.إ/i.test(t) || /\bAED\b/i.test(t) || /\bdirham\b/i.test(t)) return "AED";
  if (/^\$/.test(t)) return null; // bare $ — ambiguous
  return null;
}

function formatCompareMoneyDisplay(
  raw?: string | null,
  currencyCode?: string | null
): string {
  if (raw == null) return "—";
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—") return "—";
  const amount = parseMoneyLike(trimmed);
  if (!Number.isFinite(amount) || !/[0-9]/.test(trimmed)) return trimmed;
  const code =
    (currencyCode?.trim() || inferCurrencyFromMoneyText(trimmed) || "").toUpperCase() ||
    null;
  if (!code) return trimmed; // don't invent a currency
  return `${code} ${Math.round(amount)}`;
}

function displayCompareFieldValue(
  field: string | undefined,
  raw?: string | null,
  currencyCode?: string | null
): string {
  if (field === "Price") return formatCompareMoneyDisplay(raw, currencyCode);
  return raw ?? "—";
}

function parseMoneyLike(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseQtyLike(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatReviewDate(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function ReviewActions({
  status,
  reviewedBy,
  reviewedDate,
  remarks,
  onApprove,
  onReject,
  busy,
}: {
  status: ReviewStatus;
  reviewedBy?: string | null;
  reviewedDate?: string | null;
  remarks?: string | null;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  if (status === "approved" || status === "rejected") {
    const verb = status === "approved" ? "Approved" : "Rejected";
    const by = reviewedBy?.trim();
    const when = reviewedDate?.trim();
    return (
      <p className="text-right text-xs text-slate-500">
        {by ? `${verb} by ${by}` : verb}
        {when ? ` · ${when}` : ""}
        {remarks ? (
          <>
            <br />
            <span className="italic">&ldquo;{remarks}&rdquo;</span>
          </>
        ) : null}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="inline-flex items-center rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        Reject
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onApprove}
        className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        Approve
      </button>
    </div>
  );
}

interface JobDocumentRevisionsCardProps {
  job: Job;
  className?: string;
  /** Bumped by Status Control after upload/delete so this card refetches. */
  refreshKey?: number;
}

export function JobDocumentRevisionsCard({
  job,
  className,
  refreshKey = 0,
}: JobDocumentRevisionsCardProps) {
  const { user: me } = useAuth();
  const [docType, setDocType] = useState<DocTab>("po");

  const [poDocs, setPoDocs] = useState<FrpJobDocumentDTO[]>([]);
  const [drawingDocs, setDrawingDocs] = useState<FrpJobDocumentDTO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<number | null>(null);
  const [userNamesById, setUserNamesById] = useState<Record<number, string>>({});

  const [comparison, setComparison] = useState<FrpPoComparisonDTO | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareUnavailable, setCompareUnavailable] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showEditPoModal, setShowEditPoModal] = useState(false);
  const [poDraft, setPoDraft] = useState({
    quoteQty: "",
    quotePrice: "",
    quoteScope: "",
    poQty: "",
    poPrice: "",
    poScope: "",
  });

  const [reviewModalTarget, setReviewModalTarget] = useState<DocTab | null>(null);
  const [reviewModalAction, setReviewModalAction] = useState<"approved" | "rejected">(
    "approved"
  );
  const [reviewRemarkDraft, setReviewRemarkDraft] = useState("");

  const dbId = job.dbId;

  useEffect(() => {
    let cancelled = false;
    listUsers(0, 200)
      .then((page) => {
        if (cancelled) return;
        const map: Record<number, string> = {};
        for (const u of page.content ?? []) {
          if (u.id == null) continue;
          map[u.id] = u.displayName?.trim() || u.email || u.username || `User ${u.id}`;
        }
        if (me?.id != null) {
          map[me.id] =
            me.displayName?.trim() || me.email || me.username || map[me.id] || `User ${me.id}`;
        }
        setUserNamesById(map);
      })
      .catch(() => {
        // USER_READ may be missing; still resolve the signed-in reviewer.
        if (cancelled || me?.id == null) return;
        setUserNamesById({
          [me.id]:
            me.displayName?.trim() || me.email || me.username || `User ${me.id}`,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [me]);

  const resolveUserName = useCallback(
    (userId?: number | null) => {
      if (userId == null) return null;
      return userNamesById[userId] ?? `User ${userId}`;
    },
    [userNamesById]
  );

  const loadDocuments = useCallback(async () => {
    if (!dbId) {
      setPoDocs([]);
      setDrawingDocs([]);
      setSelectedPoId(null);
      setSelectedDrawingId(null);
      setComparison(null);
      return;
    }
    setListLoading(true);
    setError(null);
    try {
      const [production, drawings] = await Promise.all([
        listJobDocuments(dbId, { type: "PRODUCTION", sort: "ALL" }),
        listJobDocuments(dbId, { type: "DRAWING", sort: "ALL" }),
      ]);
      const poSorted = sortByVersionDesc(production);
      const drawingSorted = sortByVersionDesc(drawings);
      setPoDocs(poSorted);
      setDrawingDocs(drawingSorted);
      setSelectedPoId((prev) => {
        if (prev != null && poSorted.some((d) => d.id === prev)) return prev;
        return poSorted[0]?.id ?? null;
      });
      setSelectedDrawingId((prev) => {
        if (prev != null && drawingSorted.some((d) => d.id === prev)) return prev;
        return drawingSorted[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load documents");
      setPoDocs([]);
      setDrawingDocs([]);
    } finally {
      setListLoading(false);
    }
  }, [dbId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments, refreshKey]);

  // Poll while OCR/LLM is still running in the background after a fast upload.
  useEffect(() => {
    if (!dbId || docType !== "po" || selectedPoId == null) return;
    const selected = poDocs.find((d) => d.id === selectedPoId);
    if (selected?.extractionStatus !== "PENDING") return;
    const timer = window.setInterval(() => {
      void loadDocuments();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [dbId, docType, selectedPoId, poDocs, loadDocuments]);

  useEffect(() => {
    if (!dbId || selectedPoId == null || docType !== "po") {
      setComparison(null);
      setCompareUnavailable(false);
      return;
    }
    const selected = poDocs.find((d) => d.id === selectedPoId);
    if (selected?.extractionStatus === "PENDING") {
      setComparison(null);
      setCompareUnavailable(false);
      setCompareLoading(false);
      return;
    }
    if (selected?.extractionStatus === "FAILED") {
      setComparison(null);
      setCompareUnavailable(true);
      setCompareLoading(false);
      return;
    }
    let cancelled = false;
    setCompareLoading(true);
    setCompareUnavailable(false);
    compareJobDocument(dbId, selectedPoId)
      .then((data) => {
        if (cancelled) return;
        setComparison(data);
        setCompareUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        setComparison(null);
        setCompareUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dbId, selectedPoId, docType, poDocs]);

  const selectedPo = poDocs.find((d) => d.id === selectedPoId) ?? null;
  const selectedDrawing =
    drawingDocs.find((d) => d.id === selectedDrawingId) ?? null;
  const latestPoId = poDocs[0]?.id ?? null;
  const latestDrawingId = drawingDocs[0]?.id ?? null;

  const openEditPoModal = () => {
    if (!comparison) return;
    const fields = comparison.fields ?? [];
    const qty = fields.find((f) => f.field === "Quantity");
    const price = fields.find((f) => f.field === "Price");
    const scope = fields.find((f) => f.field === "Scope");
    setPoDraft({
      quoteQty: qty?.quote ?? "",
      quotePrice: formatCompareMoneyDisplay(price?.quote, compareCurrency),
      quoteScope: scope?.quote ?? "",
      poQty: qty?.thisPo ?? "",
      poPrice: formatCompareMoneyDisplay(price?.thisPo, compareCurrency),
      poScope: scope?.thisPo ?? "",
    });
    setShowEditPoModal(true);
  };

  const saveEditPoModal = async () => {
    if (!selectedPo?.id || !comparison) return;
    setActionBusy(true);
    setError(null);
    try {
      const base =
        comparison.editedDocumentData ??
        comparison.extractedData ??
        comparison.documentData ??
        {};
      await updateJobDocument(selectedPo.id, {
        editedDocumentData: buildEditedPoData(
          base,
          parseQtyLike(poDraft.poQty),
          parseMoneyLike(poDraft.poPrice),
          poDraft.poScope.trim()
        ),
        status: "ACTIVE",
      });
      setShowEditPoModal(false);
      await loadDocuments();
      // Force compare refresh for the same id
      const refreshed = await compareJobDocument(dbId!, selectedPo.id);
      setComparison(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save PO edits");
    } finally {
      setActionBusy(false);
    }
  };

  const openReviewModal = (target: DocTab, action: "approved" | "rejected") => {
    setReviewModalTarget(target);
    setReviewModalAction(action);
    setReviewRemarkDraft("");
  };

  const saveReviewModal = async () => {
    if (!reviewRemarkDraft.trim() || !reviewModalTarget) return;
    const docId =
      reviewModalTarget === "po" ? selectedPo?.id : selectedDrawing?.id;
    if (docId == null) return;

    setActionBusy(true);
    setError(null);
    try {
      await updateJobDocument(docId, {
        status: fromReviewStatus(reviewModalAction),
        remarks: reviewRemarkDraft.trim(),
      });
      setReviewModalTarget(null);
      await loadDocuments();
      if (reviewModalTarget === "po" && dbId) {
        const refreshed = await compareJobDocument(dbId, docId);
        setComparison(refreshed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update review status");
    } finally {
      setActionBusy(false);
    }
  };

  const openDownload = async (docId: number | undefined) => {
    if (docId == null) return;
    setError(null);
    try {
      const result = await downloadJobDocument(docId);
      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        setError("Download URL was empty");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download document");
    }
  };

  const poReviewStatus = toReviewStatus(comparison?.status ?? selectedPo?.status);
  const drawingReviewStatus = toReviewStatus(selectedDrawing?.status);
  const varianceFields = (comparison?.fields ?? []).filter((f) => f.variance);
  const anyVariance = varianceFields.length > 0 || !!comparison?.needsReview;

  const compareCurrency = (() => {
    const fromExtracted = asRecord(asRecord(comparison?.extractedData).totals).currency;
    const fromEdited = asRecord(asRecord(comparison?.editedDocumentData).totals).currency;
    const fromJob = asRecord(asRecord(comparison?.jobData).totals).currency;
    const raw = [fromExtracted, fromEdited, fromJob].find(
      (v) => typeof v === "string" && v.trim()
    );
    return typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : null;
  })();

  const poBanner = (() => {
    if (!comparison) return null;
    const changedLabels = varianceFields.map((f) => f.field).filter(Boolean).join(", ");
    if (!anyVariance) {
      return {
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        text: comparison.conclusion || "Matches the accepted quote — no review needed.",
      };
    }
    if (poReviewStatus === "approved") {
      return {
        className: "border-amber-200 bg-amber-50 text-amber-900",
        text: `Variance in ${changedLabels || "fields"} — reviewed & approved.`,
      };
    }
    if (poReviewStatus === "rejected") {
      return {
        className: "border-red-300 bg-red-100 text-red-800",
        text: `Variance in ${changedLabels || "fields"} — rejected, needs a corrected PO.`,
      };
    }
    return {
      className: "border-red-200 bg-red-50 text-red-700",
      text:
        comparison.conclusion ||
        `Variance detected in ${changedLabels || "fields"} — needs review.`,
    };
  })();

  const drawingBanner = (() => {
    if (!selectedDrawing) return null;
    const notes = selectedDrawing.remarks?.trim();
    if (!notes) {
      return {
        className: "border-slate-200 bg-slate-50 text-slate-600",
        text: "No review notes on this drawing yet.",
      };
    }
    if (drawingReviewStatus === "approved") {
      return {
        className: "border-amber-200 bg-amber-50 text-amber-900",
        text: "Drawing reviewed & approved.",
      };
    }
    if (drawingReviewStatus === "rejected") {
      return {
        className: "border-red-300 bg-red-100 text-red-800",
        text: "Drawing rejected — needs a corrected revision.",
      };
    }
    return {
      className: "border-red-200 bg-red-50 text-red-700",
      text: "Drawing pending review.",
    };
  })();

  return (
    <>
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

        {!dbId ? (
          <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-3 py-4 text-center text-sm text-slate-500">
            This job is not linked to the backend yet.
          </p>
        ) : listLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
          </div>
        ) : (
          <>
            {error ? (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {docType === "po" ? (
              poDocs.length === 0 || !selectedPo ? (
                <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-3 py-4 text-center">
                  <p className="text-sm text-slate-600">
                    No purchase order uploaded yet. Complete a{" "}
                    <span className="font-semibold text-slate-800">production</span> stage
                    in Status Control and attach the PO file in{" "}
                    <span className="font-semibold text-slate-800">Add note</span> — versions
                    will show here for review.
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Upload happens in Status Control, not here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <label className="block flex-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Version
                      <select
                        value={selectedPo.id ?? ""}
                        onChange={(e) => setSelectedPoId(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-normal normal-case text-[#111827]"
                      >
                        {poDocs.map((v) => (
                          <option key={v.id} value={v.id}>
                            {versionOptionLabel(v, latestPoId)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={openEditPoModal}
                      disabled={!comparison?.editable || compareLoading || actionBusy}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-xs font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>

                  {selectedPo.extractionStatus === "PENDING" ? (
                    <div className="space-y-3">
                      <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        Extracting PO data in the background (OCR → LLM)… this
                        card will update when ready.
                      </p>
                      <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
                        <button
                          type="button"
                          onClick={() => openDownload(selectedPo.id)}
                          className="inline-flex items-center gap-1.5 text-left hover:text-orange-700"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          {selectedPo.documentName || "Document"}
                        </button>
                      </div>
                    </div>
                  ) : compareLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Comparing with quote…
                    </div>
                  ) : comparison ? (
                    <>
                      {poBanner ? (
                        <p
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${poBanner.className}`}
                        >
                          {poBanner.text}
                        </p>
                      ) : null}

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
                            {(comparison.fields ?? []).map((d) => (
                              <tr key={d.field} className="border-t border-[#EEF1F4] align-top">
                                <td className="py-1.5 pr-2 font-semibold text-slate-700">
                                  {d.field}
                                </td>
                                <td className="py-1.5 pr-2 text-slate-600">
                                  <ComparisonValue
                                    value={displayCompareFieldValue(
                                      d.field,
                                      d.quote,
                                      compareCurrency
                                    )}
                                  />
                                </td>
                                <td
                                  className={`py-1.5 font-medium ${
                                    d.variance ? "text-red-600" : "text-emerald-600"
                                  }`}
                                >
                                  <ComparisonValue
                                    value={displayCompareFieldValue(
                                      d.field,
                                      d.thisPo,
                                      compareCurrency
                                    )}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
                        <button
                          type="button"
                          onClick={() => openDownload(selectedPo.id)}
                          className="inline-flex items-center gap-1.5 text-left hover:text-orange-700"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          {comparison.documentName || selectedPo.documentName || "Document"}
                        </button>
                      </div>

                      {anyVariance ? (
                        <div className="flex items-center justify-end">
                          <ReviewActions
                            status={poReviewStatus}
                            reviewedBy={resolveUserName(selectedPo.modifiedBy)}
                            reviewedDate={formatReviewDate(selectedPo.modifiedAt)}
                            remarks={comparison.notes ?? selectedPo.remarks}
                            busy={actionBusy}
                            onApprove={() => openReviewModal("po", "approved")}
                            onReject={() => openReviewModal("po", "rejected")}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {selectedPo.extractionStatus === "FAILED" || compareUnavailable
                          ? "PO extraction failed. Please upload the file again."
                          : "No comparison available for this purchase order yet."}
                      </p>
                      <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
                        <button
                          type="button"
                          onClick={() => openDownload(selectedPo.id)}
                          className="inline-flex items-center gap-1.5 text-left hover:text-orange-700"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          {selectedPo.documentName || "Document"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : drawingDocs.length === 0 || !selectedDrawing ? (
              <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-3 py-4 text-center">
                <p className="text-sm text-slate-600">
                  No drawing uploaded yet. Complete a{" "}
                  <span className="font-semibold text-slate-800">design</span> stage in
                  Status Control and attach the drawing file in{" "}
                  <span className="font-semibold text-slate-800">Add note</span> — revisions
                  will show here.
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Upload happens in Status Control, not here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Revision
                  <select
                    value={selectedDrawing.id ?? ""}
                    onChange={(e) => setSelectedDrawingId(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-normal normal-case text-[#111827]"
                  >
                    {drawingDocs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {versionOptionLabel(r, latestDrawingId)}
                      </option>
                    ))}
                  </select>
                </label>

                {drawingBanner ? (
                  <p
                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${drawingBanner.className}`}
                  >
                    {drawingBanner.text}
                  </p>
                ) : null}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Notes
                  </p>
                  {selectedDrawing.remarks?.trim() ? (
                    <p className="mt-1.5 text-sm text-slate-700">{selectedDrawing.remarks}</p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No remarks on this revision.</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
                  <button
                    type="button"
                    onClick={() => openDownload(selectedDrawing.id)}
                    className="inline-flex items-center gap-1.5 text-left hover:text-orange-700"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    {selectedDrawing.documentName || "Drawing"}
                  </button>
                  {selectedDrawing.milestoneStageName ? (
                    <span className="text-xs text-slate-500">
                      {selectedDrawing.milestoneStageName}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-end">
                  <ReviewActions
                    status={drawingReviewStatus}
                    reviewedBy={resolveUserName(selectedDrawing.modifiedBy)}
                    reviewedDate={formatReviewDate(selectedDrawing.modifiedAt)}
                    remarks={selectedDrawing.remarks}
                    busy={actionBusy}
                    onApprove={() => openReviewModal("drawing", "approved")}
                    onReject={() => openReviewModal("drawing", "rejected")}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </WidgetCard>

      <EditModal
        open={showEditPoModal}
        title="Edit Purchase Order Version"
        onClose={() => setShowEditPoModal(false)}
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Accepted quote (baseline)
          </p>
          <ModalField label="Quote quantity" value={poDraft.quoteQty} onChange={() => {}} disabled />
          <ModalField label="Quote price" value={poDraft.quotePrice} onChange={() => {}} disabled />
          <ModalField
            label="Quote scope"
            value={poDraft.quoteScope}
            onChange={() => {}}
            disabled
            multiline
          />
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            This PO
          </p>
          <ModalField
            label="PO quantity"
            value={poDraft.poQty}
            onChange={(v) => setPoDraft((d) => ({ ...d, poQty: v }))}
          />
          <ModalField
            label="PO price"
            value={poDraft.poPrice}
            onChange={(v) => setPoDraft((d) => ({ ...d, poPrice: v }))}
          />
          <ModalField
            label="PO scope"
            value={poDraft.poScope}
            onChange={(v) => setPoDraft((d) => ({ ...d, poScope: v }))}
            multiline
          />
          <button
            className="btn-primary w-full"
            onClick={() => void saveEditPoModal()}
            disabled={actionBusy}
          >
            {actionBusy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </EditModal>

      <EditModal
        open={reviewModalTarget !== null}
        title={reviewModalAction === "approved" ? "Approve" : "Reject"}
        onClose={() => setReviewModalTarget(null)}
      >
        <div className="space-y-3">
          <ModalField
            label="Remarks"
            value={reviewRemarkDraft}
            onChange={setReviewRemarkDraft}
            placeholder={
              reviewModalAction === "approved"
                ? "Why this is being approved…"
                : "Why this is being rejected…"
            }
            multiline
          />
          <button
            className="btn-primary w-full"
            onClick={() => void saveReviewModal()}
            disabled={!reviewRemarkDraft.trim() || actionBusy}
          >
            {actionBusy
              ? "Saving…"
              : reviewModalAction === "approved"
                ? "Approve"
                : "Reject"}
          </button>
        </div>
      </EditModal>
    </>
  );
}
