"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileStack,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { WidgetCard } from "@/components/JobWidgetCard";
import { EditModal, ModalField } from "@/components/JobEditModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PoManualEntryFields } from "@/components/PoManualEntryFields";
import { useAuth } from "@/context/AuthContext";
import {
  compareJobDocument,
  createManualPoDocument,
  deleteJobDocument,
  downloadJobDocument,
  listJobDocuments,
  listJobStages,
  listUsers,
  updateJobDocument,
  uploadJobDocument,
} from "@/lib/frp/api";
import type {
  FrpDocumentStatus,
  FrpJobDocumentDTO,
  FrpPoComparisonDTO,
  FrpPoComparisonFieldDTO,
} from "@/lib/frp/job-mapper";
import {
  emptyPoItemRow,
  firstPoItemRowsError,
  isManualPoDocument,
  lineItemsFromRows,
  manualPoDocumentNameFromRows,
  manualPoLineItemsFromRows,
  poDocumentDisplayName,
  totalPriceFromRows,
  type PoItemRow,
} from "@/lib/poLineItems";
import { isCancelledJob } from "@/lib/frp/job-status";
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
  const name = poDocumentDisplayName(doc, undefined, "Untitled");
  const latest = doc.id != null && doc.id === latestId ? " (latest)" : "";
  return `${ver} · ${name}${latest}`;
}

function PoPaperclipLabel({
  doc,
  extraData,
  onDownload,
}: {
  doc: FrpJobDocumentDTO;
  extraData?: Record<string, unknown> | null;
  onDownload: (id: number | undefined) => void;
}) {
  const label = poDocumentDisplayName(doc, extraData);
  if (!doc.mimeType) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onDownload(doc.id)}
      className="inline-flex items-center gap-1.5 text-left hover:text-orange-700"
    >
      <Paperclip className="h-3.5 w-3.5 text-slate-400" />
      {label}
    </button>
  );
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

function poDetailValue(data: Record<string, unknown> | null | undefined, key: string): string {
  const value = data?.[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "—";
}

/** A PO document's own saved currency (`totals.currency`), if it has one. */
function poDocCurrency(doc: FrpJobDocumentDTO): string {
  const source = asRecord(doc.editedDocumentData ?? doc.documentData);
  const currency = asRecord(source.totals).currency;
  return typeof currency === "string" ? currency.trim().toUpperCase() : "";
}

const ORDER_EXTRA_KEYS: { field: string; key: string }[] = [
  { field: "Order Date", key: "orderDate" },
  { field: "Buyer Name", key: "buyerContact" },
  { field: "Quote Number", key: "quoteNumber" },
  { field: "Supplier", key: "supplierName" },
];

/** Order-level keys that compare `fields` does not already emit. */
function extraOrderCompareRows(
  comparison: FrpPoComparisonDTO
): { field: string; quote: string; thisPo: string }[] {
  const existing = new Set(
    (comparison.fields ?? [])
      .filter((f) => f.group === "Order")
      .map((f) => f.field)
  );
  const job = asRecord(comparison.jobData);
  const po = asRecord(comparison.extractedData);
  return ORDER_EXTRA_KEYS.filter((row) => !existing.has(row.field))
    .map((row) => ({
      field: row.field,
      quote: poDetailValue(job, row.key),
      thisPo: poDetailValue(po, row.key),
    }))
    .filter((row) => row.quote !== "—" || row.thisPo !== "—");
}

function asMapList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
}

function lineItemText(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function lineItemNumber(item: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = item[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function groupCompareFields(
  fields: FrpPoComparisonFieldDTO[]
): { group: string; matchedBy?: string; rows: FrpPoComparisonFieldDTO[] }[] {
  const groups: { group: string; matchedBy?: string; rows: FrpPoComparisonFieldDTO[] }[] = [];
  for (const row of fields) {
    const name = row.group?.trim() || "Details";
    const last = groups[groups.length - 1];
    if (last && last.group === name) {
      last.rows.push(row);
    } else {
      groups.push({ group: name, matchedBy: row.matchedBy, rows: [row] });
    }
  }
  return groups;
}

function matchedByHint(matchedBy?: string): string | null {
  switch (matchedBy) {
    case "SOURCE_CODE":
      return "matched by item code";
    case "DESCRIPTION":
      return "matched by description";
    case "POSITION":
      return "not matched by item code — paired by list order";
    default:
      return null;
  }
}

function compareFieldKey(row: FrpPoComparisonFieldDTO, index: number): string {
  return [
    row.group ?? "row",
    row.field ?? "field",
    row.quoteLineIndex ?? "q",
    row.poLineIndex ?? "p",
    index,
  ].join(":");
}

const ITEM_CODE_KEYS = [
  "sourceCode",
  "item_code",
  "itemCode",
  "code",
  "sku",
  "product_code",
  "id",
];

function lineItemCode(item: Record<string, unknown> | undefined): string {
  if (!item) return "—";
  return lineItemText(item, ITEM_CODE_KEYS) ?? "—";
}

/** Item code from jobData / extractedData using the compare row indexes. */
function itemCodeCompareRow(
  comparison: FrpPoComparisonDTO,
  sample: FrpPoComparisonFieldDTO
): FrpPoComparisonFieldDTO {
  const quoteLines = asMapList(asRecord(comparison.jobData).lineItems);
  const poLines = asMapList(asRecord(comparison.extractedData).lineItems);
  const quote =
    sample.quoteLineIndex != null ? lineItemCode(quoteLines[sample.quoteLineIndex]) : "—";
  const thisPo =
    sample.poLineIndex != null ? lineItemCode(poLines[sample.poLineIndex]) : "—";
  const bothMissing = quote === "—" && thisPo === "—";
  return {
    group: sample.group,
    field: "Item Code",
    quote,
    thisPo,
    variance: !bothMissing && quote !== thisPo,
    matchedBy: sample.matchedBy,
    quoteLineIndex: sample.quoteLineIndex,
    poLineIndex: sample.poLineIndex,
  };
}

function rowsWithItemCode(
  comparison: FrpPoComparisonDTO,
  section: { group: string; rows: FrpPoComparisonFieldDTO[] }
): FrpPoComparisonFieldDTO[] {
  if (!section.group.startsWith("Item") || section.rows.length === 0) {
    return section.rows;
  }
  if (section.rows.some((r) => r.field === "Item Code")) return section.rows;
  return [itemCodeCompareRow(comparison, section.rows[0]), ...section.rows];
}

/**
 * Build `editedDocumentData` from the full manual PO-details form — order
 * metadata plus the repeatable line items that drive the quote comparison.
 * One form covers both, so there's a single place to fill things in whether
 * extraction succeeded (editing a couple of values) or failed outright
 * (entering everything by hand).
 */
function buildEditedPoFull(
  base: Record<string, unknown> | null | undefined,
  details: {
    orderNo: string;
    orderDate: string;
    buyerName: string;
    expectedDate: string;
    currency: string;
    items: PoItemRow[];
  }
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(base ?? {}) };
  next.orderNo = details.orderNo.trim();
  next.orderDate = details.orderDate.trim();
  next.buyerContact = details.buyerName.trim();
  next.expectedDate = details.expectedDate.trim();
  next.lineItems = lineItemsFromRows(details.items);

  const totals = { ...asRecord(next.totals) };
  totals.amountAfterTax = totalPriceFromRows(details.items);
  const currency = details.currency.trim().toUpperCase();
  if (currency) totals.currency = currency;
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

function formatReviewDate(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function reviewModalTitle(target: DocTab, action: "approved" | "rejected"): string {
  const doc = target === "po" ? "purchase order" : "drawing";
  return action === "approved" ? `Approve ${doc}` : `Reject ${doc}`;
}

function reviewRemarkPlaceholder(
  target: DocTab,
  action: "approved" | "rejected"
): string {
  if (target === "po") {
    return action === "approved"
      ? "e.g. Quantity variance accepted — client confirmed in writing."
      : "e.g. Price does not match the accepted quote. Request a revised PO.";
  }
  return action === "approved"
    ? "e.g. Revision matches the approved design and site measurements."
    : "e.g. Dimensions do not match the approved design. Request a corrected revision.";
}

function ReviewActions({
  status,
  reviewedBy,
  reviewedDate,
  remarks,
  onApprove,
  onReject,
  busy,
  locked,
}: {
  status: ReviewStatus;
  reviewedBy?: string | null;
  reviewedDate?: string | null;
  remarks?: string | null;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
  locked?: boolean;
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
  if (locked) {
    return (
      <p className="text-right text-xs text-slate-500">Cancelled — not editable</p>
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

function ComparisonAccordion({
  title,
  open,
  onToggle,
  children,
  action,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
      <div className="flex items-center gap-2 bg-[#FAFBFC] px-2 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-sm font-semibold text-slate-800 hover:bg-orange-50/60"
        >
          <span>{title}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>
        {action}
      </div>
      {open ? (
        <div className="border-t border-[#E5E7EB] bg-white p-3">{children}</div>
      ) : null}
    </div>
  );
}

interface JobDocumentRevisionsCardProps {
  job: Job;
  className?: string;
  /** Bumped by Status Control after upload/delete so this card refetches. */
  refreshKey?: number;
  /** Select this PO or drawing after a click elsewhere on the job page. */
  focusDocument?: { documentId: number; tab: DocTab } | null;
  /** Re-pull job detail (timeline, factory status) after a review save. */
  onJobChanged?: () => void | Promise<void>;
  /** Bumps the Project documents strip's refresh key after add/delete. */
  onDocumentsChanged?: () => void;
}

export function JobDocumentRevisionsCard({
  job,
  className,
  refreshKey = 0,
  focusDocument = null,
  onJobChanged,
  onDocumentsChanged,
}: JobDocumentRevisionsCardProps) {
  const locked = isCancelledJob(job.status);
  const { user: me } = useAuth();
  const [docType, setDocType] = useState<DocTab>("po");
  const [poCompareOpen, setPoCompareOpen] = useState(false);
  const [drawingCompareOpen, setDrawingCompareOpen] = useState(false);

  const [poDocs, setPoDocs] = useState<FrpJobDocumentDTO[]>([]);
  const [drawingDocs, setDrawingDocs] = useState<FrpJobDocumentDTO[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<number | null>(null);
  // Tracks the latest version's id across fetches so a genuinely new PO/drawing
  // (uploaded here, from Status Control, or anywhere else) can be auto-selected
  // without disturbing the user's pick when a refetch finds no new version.
  const prevLatestPoIdRef = useRef<number | null>(null);
  const prevLatestDrawingIdRef = useRef<number | null>(null);
  const [userNamesById, setUserNamesById] = useState<Record<number, string>>({});

  const [comparison, setComparison] = useState<FrpPoComparisonDTO | null>(null);
  const [showAllPoItems, setShowAllPoItems] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareUnavailable, setCompareUnavailable] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Add PO" — a brand-new PO record, either a real file upload (normal
  // OCR/LLM path) or entered by hand with no attachment. The manual path
  // needs the backend's file-optional create endpoint; until that ships,
  // saving that way 400s the same way dropping the file field always has.
  const [showAddPoModal, setShowAddPoModal] = useState(false);
  const [addPoMode, setAddPoMode] = useState<"upload" | "manual">("upload");
  const [addPoBusy, setAddPoBusy] = useState(false);
  const [addPoError, setAddPoError] = useState<string | null>(null);
  const [addPoFile, setAddPoFile] = useState<File | null>(null);
  const [addPoRemarks, setAddPoRemarks] = useState("");
  const [addPoDetails, setAddPoDetails] = useState({
    orderNo: "",
    orderDate: "",
    buyerName: "",
    expectedDate: "",
    currency: "",
  });
  const [addPoItems, setAddPoItems] = useState([emptyPoItemRow()]);
  // Set once when the modal opens (not derived live from the draft) so typing
  // the first character doesn't immediately re-lock the field mid-entry.
  const [addPoBuyerEditable, setAddPoBuyerEditable] = useState(false);

  // Full PO-details form — order metadata plus quantity/price/scope. Filled
  // in by hand when OCR/LLM extraction fails, or edited afterwards either
  // way. Quote-side fields are read-only context, only populated once a
  // comparison exists.
  const [showPoDetailsModal, setShowPoDetailsModal] = useState(false);
  const [poDetailsDraft, setPoDetailsDraft] = useState({
    quoteQty: "",
    quotePrice: "",
    quoteScope: "",
    orderNo: "",
    orderDate: "",
    buyerName: "",
    expectedDate: "",
    currency: "",
  });
  const [poDetailsItems, setPoDetailsItems] = useState([emptyPoItemRow()]);
  const [poDetailsBuyerEditable, setPoDetailsBuyerEditable] = useState(false);

  const [showDeletePoConfirm, setShowDeletePoConfirm] = useState(false);
  const [deletePoBusy, setDeletePoBusy] = useState(false);
  const [deletePoError, setDeletePoError] = useState<string | null>(null);
  const [showDeleteDrawingConfirm, setShowDeleteDrawingConfirm] = useState(false);
  const [deleteDrawingBusy, setDeleteDrawingBusy] = useState(false);
  const [deleteDrawingError, setDeleteDrawingError] = useState<string | null>(null);

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
      prevLatestPoIdRef.current = null;
      prevLatestDrawingIdRef.current = null;
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

      const newLatestPoId = poSorted[0]?.id ?? null;
      const poHasNewLatest = newLatestPoId !== prevLatestPoIdRef.current;
      prevLatestPoIdRef.current = newLatestPoId;
      setSelectedPoId((prev) => {
        if (poHasNewLatest) return newLatestPoId;
        if (prev != null && poSorted.some((d) => d.id === prev)) return prev;
        return newLatestPoId;
      });

      const newLatestDrawingId = drawingSorted[0]?.id ?? null;
      const drawingHasNewLatest = newLatestDrawingId !== prevLatestDrawingIdRef.current;
      prevLatestDrawingIdRef.current = newLatestDrawingId;
      setSelectedDrawingId((prev) => {
        if (drawingHasNewLatest) return newLatestDrawingId;
        if (prev != null && drawingSorted.some((d) => d.id === prev)) return prev;
        return newLatestDrawingId;
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

  // `focusDocument` comes from the parent and is never cleared after a
  // navigation click, so without tracking what's already been applied, this
  // would re-force the selection back to that stale target on every later
  // refresh — including stomping on a genuinely new latest PO/drawing that
  // just got uploaded. Only (re)apply it when it names a document we haven't
  // already jumped to, retrying while the target doc is still loading.
  const appliedFocusRef = useRef<{ documentId: number; tab: DocTab } | null>(null);
  useEffect(() => {
    if (!focusDocument) return;
    if (
      appliedFocusRef.current?.documentId === focusDocument.documentId &&
      appliedFocusRef.current?.tab === focusDocument.tab
    ) {
      return;
    }
    setDocType(focusDocument.tab);
    if (focusDocument.tab === "po") {
      setPoCompareOpen(true);
      if (poDocs.some((d) => d.id === focusDocument.documentId)) {
        setSelectedPoId(focusDocument.documentId);
        appliedFocusRef.current = focusDocument;
      }
    } else if (drawingDocs.some((d) => d.id === focusDocument.documentId)) {
      setDrawingCompareOpen(true);
      setSelectedDrawingId(focusDocument.documentId);
      appliedFocusRef.current = focusDocument;
    }
  }, [focusDocument, poDocs, drawingDocs]);

  useEffect(() => {
    setShowAllPoItems(false);
  }, [selectedPoId]);

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
    const hasManualOverride = !!(
      selected?.editedDocumentData && Object.keys(selected.editedDocumentData).length > 0
    );
    if (selected?.extractionStatus === "FAILED" && !hasManualOverride) {
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

  /** Opens the full PO-details form (order metadata + repeatable line
   *  items), pre-filled from whatever data already exists (LLM-extracted or
   *  a prior manual save) — the one entry point for editing a PO's own
   *  details, whether extraction succeeded (a couple of corrections) or
   *  failed outright (everything entered by hand). Quote-side reference
   *  values only show once a comparison already exists. Order No is
   *  editable here since extraction can fail to read it. Buyer Name is a
   *  fixed job-level fact once known (job contact, or whatever was saved on
   *  this PO before) — locked in that case; editable only while genuinely
   *  blank, and locks again the moment it's saved. */
  const openPoDetailsModal = () => {
    const source =
      comparison?.extractedData ??
      selectedPo?.editedDocumentData ??
      selectedPo?.documentData ??
      {};
    const fields = comparison?.fields ?? [];
    const qty = fields.find((f) => f.field === "Quantity");
    const price = fields.find((f) => f.field === "Price");
    const scope = fields.find((f) => f.field === "Description" || f.field === "Scope");
    const buyerName =
      job.clientContactName?.trim() ||
      (typeof source.buyerContact === "string" ? source.buyerContact.trim() : "");
    setPoDetailsBuyerEditable(!buyerName);
    setPoDetailsDraft({
      quoteQty: qty?.quote ?? "",
      quotePrice: price?.quote ?? "",
      quoteScope: scope?.quote ?? "",
      orderNo: typeof source.orderNo === "string" ? source.orderNo : "",
      orderDate: typeof source.orderDate === "string" ? source.orderDate : "",
      buyerName,
      expectedDate: typeof source.expectedDate === "string" ? source.expectedDate : "",
      currency:
        typeof asRecord(asRecord(source).totals).currency === "string"
          ? String(asRecord(asRecord(source).totals).currency).trim().toUpperCase()
          : "",
    });
    const rows = asMapList(source.lineItems).map((item) => ({
      sourceCode:
        lineItemText(item, [
          "sourceCode",
          "item_code",
          "itemCode",
          "code",
          "sku",
          "product_code",
          "id",
        ]) ?? "",
      quantity: lineItemNumber(item, ["quantity", "qty"])?.toString() ?? "",
      price: lineItemNumber(item, ["lineTotal", "unitPrice"])?.toString() ?? "",
      description: lineItemText(item, ["description", "heading", "title", "name"]) ?? "",
    }));
    setPoDetailsItems(rows.length > 0 ? rows : [emptyPoItemRow()]);
    setShowPoDetailsModal(true);
  };

  const savePoDetailsModal = async () => {
    if (!selectedPo?.id) return;
    const itemsError = firstPoItemRowsError(poDetailsItems);
    if (itemsError) {
      setError(itemsError);
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const base =
        comparison?.editedDocumentData ??
        selectedPo.editedDocumentData ??
        comparison?.extractedData ??
        comparison?.documentData ??
        selectedPo.documentData ??
        {};
      await updateJobDocument(selectedPo.id, {
        editedDocumentData: buildEditedPoFull(base, {
          orderNo: poDetailsDraft.orderNo,
          orderDate: poDetailsDraft.orderDate,
          buyerName: poDetailsDraft.buyerName,
          expectedDate: poDetailsDraft.expectedDate,
          currency: poDetailsDraft.currency,
          items: poDetailsItems,
        }),
        ...(isManualPoDocument(selectedPo)
          ? { documentName: manualPoDocumentNameFromRows(poDetailsDraft.orderNo, poDetailsItems) }
          : {}),
        status: "ACTIVE",
      });
      setShowPoDetailsModal(false);
      await loadDocuments();
      // Now that editedDocumentData is populated, the backend allows compare
      // even on a FAILED extraction — refresh immediately instead of waiting
      // on the polling effect to notice `poDocs` changed.
      const refreshed = await compareJobDocument(dbId!, selectedPo.id);
      setComparison(refreshed);
      setCompareUnavailable(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save PO details");
    } finally {
      setActionBusy(false);
    }
  };

  const openAddPoModal = () => {
    if (locked) return;
    setAddPoMode("upload");
    setAddPoFile(null);
    setAddPoRemarks("");
    // Order No is a fixed job-level fact, not typed per PO. Buyer Name locks
    // once known (job contact) but stays editable while genuinely blank.
    // Currency defaults to whatever this job's existing PO(s) already used,
    // so it doesn't have to be re-picked on every additional PO for the same
    // order — first doc (by version/id) that actually has one wins; blank if
    // none do.
    const buyerName = job.clientContactName?.trim() ?? "";
    setAddPoBuyerEditable(!buyerName);
    setAddPoDetails({
      orderNo: job.orderNumber ?? "",
      orderDate: "",
      buyerName,
      expectedDate: "",
      currency: poDocs.map(poDocCurrency).find((c) => c) ?? "",
    });
    setAddPoItems([emptyPoItemRow()]);
    setAddPoError(null);
    setShowAddPoModal(true);
  };

  /** Every PO version shares one jobStageId (the production stage) —
   *  reuse it from an existing version if there is one, else look up the
   *  job's production milestone directly. */
  const resolveProductionStageId = async (): Promise<number | null> => {
    if (poDocs[0]?.jobStageId != null) return poDocs[0].jobStageId;
    if (!dbId) return null;
    try {
      const stages = await listJobStages(dbId);
      return stages.find((s) => s.stageKey === "production")?.id ?? null;
    } catch {
      return null;
    }
  };

  const saveAddPoModal = async () => {
    if (!dbId) return;
    setAddPoBusy(true);
    setAddPoError(null);
    try {
      const jobStageId = await resolveProductionStageId();
      if (jobStageId == null) {
        setAddPoError("Could not find a production stage to attach this PO to.");
        return;
      }

      if (addPoMode === "upload") {
        if (!addPoFile) {
          setAddPoError("Choose a file to upload.");
          return;
        }
        await uploadJobDocument(dbId, {
          jobStageId,
          file: addPoFile,
          remarks: addPoRemarks.trim() || undefined,
        });
      } else {
        const itemsError = firstPoItemRowsError(addPoItems);
        if (itemsError) {
          setAddPoError(itemsError);
          return;
        }
        const lineItems = manualPoLineItemsFromRows(addPoItems);
        if (lineItems.length === 0) {
          setAddPoError("Add at least one line item.");
          return;
        }
        await createManualPoDocument(dbId, {
          jobStageId,
          documentName: manualPoDocumentNameFromRows(addPoDetails.orderNo, addPoItems),
          orderNo: addPoDetails.orderNo.trim() || undefined,
          orderDate: addPoDetails.orderDate.trim() || undefined,
          expectedDate: addPoDetails.expectedDate.trim() || undefined,
          buyerName: addPoDetails.buyerName.trim() || undefined,
          quoteNumber: job.quoteNumber?.trim() || undefined,
          currency: addPoDetails.currency.trim() || undefined,
          remarks: addPoRemarks.trim() || undefined,
          lineItems,
        });
      }
      setShowAddPoModal(false);
      await loadDocuments();
      onDocumentsChanged?.();
    } catch (e) {
      setAddPoError(e instanceof Error ? e.message : "Could not add PO");
    } finally {
      setAddPoBusy(false);
    }
  };

  /** Delete the currently selected PO version — only offered while it's
   *  still pending review; once approved/rejected it's part of the audit
   *  trail and shouldn't be removable. */
  const deleteSelectedPo = async () => {
    if (!selectedPo?.id) return;
    setDeletePoBusy(true);
    setDeletePoError(null);
    try {
      await deleteJobDocument(selectedPo.id);
      setShowDeletePoConfirm(false);
      await loadDocuments();
      onDocumentsChanged?.();
    } catch (e) {
      setDeletePoError(e instanceof Error ? e.message : "Could not delete PO");
    } finally {
      setDeletePoBusy(false);
    }
  };

  /** Delete the currently selected drawing revision — only offered while
   *  it's still pending review; once approved/rejected it's part of the
   *  audit trail and shouldn't be removable. */
  const deleteSelectedDrawing = async () => {
    if (!selectedDrawing?.id) return;
    setDeleteDrawingBusy(true);
    setDeleteDrawingError(null);
    try {
      await deleteJobDocument(selectedDrawing.id);
      setShowDeleteDrawingConfirm(false);
      await loadDocuments();
      onDocumentsChanged?.();
    } catch (e) {
      setDeleteDrawingError(e instanceof Error ? e.message : "Could not delete drawing");
    } finally {
      setDeleteDrawingBusy(false);
    }
  };

  const openReviewModal = (target: DocTab, action: "approved" | "rejected") => {
    if (locked) return;
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
      await Promise.all([
        loadDocuments(),
        onJobChanged?.(),
      ]);
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

  const compareGroups = groupCompareFields(comparison?.fields ?? []);
  const extraOrderRows = comparison ? extraOrderCompareRows(comparison) : [];
  const compareSections =
    extraOrderRows.length > 0 && !compareGroups.some((s) => s.group === "Order")
      ? [{ group: "Order", matchedBy: undefined as string | undefined, rows: [] }, ...compareGroups]
      : compareGroups;

  const PO_ITEM_PREVIEW_COUNT = 2;
  const totalItemSections = compareSections.filter((s) => s.group.startsWith("Item")).length;
  const hasMorePoItems = totalItemSections > PO_ITEM_PREVIEW_COUNT;
  let visibleItemSections = 0;
  const visibleCompareSections = compareSections.filter((s) => {
    if (!s.group.startsWith("Item")) return true;
    visibleItemSections += 1;
    return showAllPoItems || visibleItemSections <= PO_ITEM_PREVIEW_COUNT;
  });
  const lastVisibleItemGroup = [...visibleCompareSections]
    .reverse()
    .find((s) => s.group.startsWith("Item"))?.group;

  const poBanner = (() => {
    if (!comparison) return null;
    const changedLabels = [...new Set(varianceFields.map((f) => f.field).filter(Boolean))].join(
      ", "
    );
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
      <WidgetCard
        id="job-document-versions"
        title="Document Versions"
        icon={FileStack}
        className={`scroll-mt-6${className ? ` ${className}` : ""}`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-0.5 text-xs font-semibold">
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
            <button
              type="button"
              onClick={openAddPoModal}
              disabled={locked}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add New PO
            </button>
          ) : null}
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
                      onClick={openPoDetailsModal}
                      disabled={
                        selectedPo.extractionStatus === "PENDING" || compareLoading || actionBusy
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-xs font-medium text-slate-600 hover:border-orange-200 hover:text-orange-700 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    {toReviewStatus(selectedPo.status) === "pending" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePoError(null);
                          setShowDeletePoConfirm(true);
                        }}
                        disabled={locked || actionBusy}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    ) : null}
                  </div>

                  {selectedPo.extractionStatus === "PENDING" ? (
                    <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Extracting PO data in the background… this card will
                      update when ready.
                    </p>
                  ) : compareLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Comparing with quote…
                    </div>
                  ) : (
                    <ComparisonAccordion
                      title="PO Comparison"
                      open={poCompareOpen}
                      onToggle={() => setPoCompareOpen((v) => !v)}
                    >
                      {comparison ? (
                        <div className="space-y-3">
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
                                {compareSections.length === 0 && extraOrderRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="py-2 text-sm text-slate-500">
                                      No comparison fields returned for this PO.
                                    </td>
                                  </tr>
                                ) : (
                                  visibleCompareSections.map((section) => {
                                    const hint = section.group.startsWith("Item")
                                      ? matchedByHint(section.matchedBy)
                                      : null;
                                    const extraRows = section.group === "Order" ? extraOrderRows : [];
                                    const rows = comparison
                                      ? rowsWithItemCode(comparison, section)
                                      : section.rows;
                                    return (
                                      <Fragment key={section.group}>
                                        <tr className="border-t-2 border-[#E5E7EB]">
                                          <td
                                            colSpan={3}
                                            className="bg-[#FAFBFC] py-1 pr-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                                          >
                                            {section.group}
                                            {hint ? (
                                              <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                                                {hint}
                                              </span>
                                            ) : null}
                                          </td>
                                        </tr>
                                        {rows.map((d, index) => (
                                          <tr
                                            key={compareFieldKey(d, index)}
                                            className="border-t border-[#EEF1F4] align-top"
                                          >
                                            <td className="py-1.5 pr-2 font-semibold text-slate-700">
                                              {d.field === "Scope" ? "Description" : d.field}
                                            </td>
                                            <td className="py-1.5 pr-2 text-slate-600">
                                              <ComparisonValue value={d.quote ?? "—"} />
                                            </td>
                                            <td
                                              className={`py-1.5 font-medium ${
                                                d.variance ? "text-red-600" : "text-emerald-600"
                                              }`}
                                            >
                                              <ComparisonValue value={d.thisPo ?? "—"} />
                                            </td>
                                          </tr>
                                        ))}
                                        {extraRows.map((row) => (
                                          <tr
                                            key={`extra:${row.field}`}
                                            className="border-t border-[#EEF1F4] align-top"
                                          >
                                            <td className="py-1.5 pr-2 font-semibold text-slate-700">
                                              {row.field}
                                            </td>
                                            <td className="py-1.5 pr-2 text-slate-600">
                                              <ComparisonValue value={row.quote} />
                                            </td>
                                            <td className="py-1.5 font-medium text-slate-700">
                                              <ComparisonValue value={row.thisPo} />
                                            </td>
                                          </tr>
                                        ))}
                                        {hasMorePoItems && section.group === lastVisibleItemGroup ? (
                                          <tr className="border-t border-[#EEF1F4]">
                                            <td colSpan={3} className="py-2">
                                              <div className="flex justify-center sm:justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => setShowAllPoItems((v) => !v)}
                                                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 transition-colors hover:border-orange-300 hover:bg-orange-100 hover:text-orange-800"
                                                >
                                                  {showAllPoItems ? (
                                                    <>
                                                      <ChevronUp className="h-3.5 w-3.5" />
                                                      Show less
                                                    </>
                                                  ) : (
                                                    <>
                                                      <ChevronDown className="h-3.5 w-3.5" />
                                                      {`Load more (${totalItemSections - PO_ITEM_PREVIEW_COUNT} more)`}
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ) : null}
                                      </Fragment>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            {selectedPo.extractionStatus === "FAILED" || compareUnavailable
                              ? "PO extraction failed. You can re-upload the file, or add the order details by hand below."
                              : "No comparison available for this purchase order yet."}
                          </p>
                          {selectedPo.extractionStatus === "FAILED" ? (
                            <button
                              type="button"
                              onClick={openPoDetailsModal}
                              disabled={actionBusy}
                              className="btn-primary w-full"
                            >
                              Enter PO details manually
                            </button>
                          ) : null}
                        </div>
                      )}
                    </ComparisonAccordion>
                  )}

                  <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
                    <PoPaperclipLabel
                      doc={selectedPo}
                      extraData={
                        comparison?.extractedData ?? comparison?.editedDocumentData
                      }
                      onDownload={openDownload}
                    />
                    {comparison || selectedPo.status ? (
                      <ReviewActions
                        status={poReviewStatus}
                        reviewedBy={resolveUserName(selectedPo.modifiedBy)}
                        reviewedDate={formatReviewDate(selectedPo.modifiedAt)}
                        remarks={comparison?.notes ?? selectedPo.remarks}
                        busy={actionBusy}
                        locked={locked}
                        onApprove={() => openReviewModal("po", "approved")}
                        onReject={() => openReviewModal("po", "rejected")}
                      />
                    ) : null}
                  </div>
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
                <div className="flex items-end gap-2">
                  <label className="block flex-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
                  {drawingReviewStatus === "pending" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteDrawingError(null);
                        setShowDeleteDrawingConfirm(true);
                      }}
                      disabled={locked || actionBusy}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>

                <ComparisonAccordion
                  title="Drawing Comparison"
                  open={drawingCompareOpen}
                  onToggle={() => setDrawingCompareOpen((v) => !v)}
                >
                  <div className="space-y-3">
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
                  </div>
                </ComparisonAccordion>

                <div className="flex items-center justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm text-slate-600">
                  <button
                    type="button"
                    onClick={() => openDownload(selectedDrawing.id)}
                    className="inline-flex items-center gap-1.5 text-left hover:text-orange-700"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    {selectedDrawing.documentName || "Drawing"}
                  </button>
                  <div className="flex items-center gap-3">
                    {selectedDrawing.milestoneStageName ? (
                      <span className="text-xs text-slate-500">
                        {selectedDrawing.milestoneStageName}
                      </span>
                    ) : null}
                    <ReviewActions
                      status={drawingReviewStatus}
                      reviewedBy={resolveUserName(selectedDrawing.modifiedBy)}
                      reviewedDate={formatReviewDate(selectedDrawing.modifiedAt)}
                      remarks={selectedDrawing.remarks}
                      busy={actionBusy}
                      locked={locked}
                      onApprove={() => openReviewModal("drawing", "approved")}
                      onReject={() => openReviewModal("drawing", "rejected")}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </WidgetCard>

      <EditModal
        open={showPoDetailsModal}
        title="Edit PO"
        onClose={() => setShowPoDetailsModal(false)}
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {comparison ? (
            <>
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Accepted quote (baseline)
              </p>
              <ModalField label="Quote quantity" value={poDetailsDraft.quoteQty} onChange={() => {}} disabled />
              <ModalField label="Quote price" value={poDetailsDraft.quotePrice} onChange={() => {}} disabled />
              <ModalField
                label="Quote scope"
                value={poDetailsDraft.quoteScope}
                onChange={() => {}}
                disabled
                multiline
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Entered by hand — used in place of (or alongside) whatever
              OCR/LLM extraction managed to read.
            </p>
          )}
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            This PO
          </p>
          <PoManualEntryFields
            details={{
              orderNo: poDetailsDraft.orderNo,
              orderDate: poDetailsDraft.orderDate,
              buyerName: poDetailsDraft.buyerName,
              expectedDate: poDetailsDraft.expectedDate,
              currency: poDetailsDraft.currency,
            }}
            onDetailsChange={(next) => setPoDetailsDraft((d) => ({ ...d, ...next }))}
            buyerNameEditable={poDetailsBuyerEditable}
            items={poDetailsItems}
            onItemsChange={setPoDetailsItems}
          />

          <button
            className="btn-primary w-full"
            onClick={() => void savePoDetailsModal()}
            disabled={actionBusy}
          >
            {actionBusy ? "Saving…" : "Save details"}
          </button>
        </div>
      </EditModal>

      <EditModal
        open={showAddPoModal}
        title="Add New PO"
        onClose={() => setShowAddPoModal(false)}
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="inline-flex rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAddPoMode("upload")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                addPoMode === "upload"
                  ? "bg-white text-orange-700 shadow-sm border border-orange-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Upload file
            </button>
            <button
              type="button"
              onClick={() => setAddPoMode("manual")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                addPoMode === "manual"
                  ? "bg-white text-orange-700 shadow-sm border border-orange-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Enter manually
            </button>
          </div>

          {addPoError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {addPoError}
            </p>
          ) : null}

          {addPoMode === "upload" ? (
            <>
              <p className="text-sm text-slate-600">
                Uploads and extracts details automatically (OCR → LLM), same as
                attaching a PO from Status Control.
              </p>
              <label className="block text-sm font-medium text-slate-700">
                File
                <input
                  type="file"
                  onChange={(e) => setAddPoFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-orange-700"
                />
              </label>
              {addPoFile ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-sm text-orange-800">
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{addPoFile.name}</span>
                </div>
              ) : null}
              <ModalField
                label="Remarks"
                value={addPoRemarks}
                onChange={setAddPoRemarks}
                placeholder="e.g. Revised PO after quantity change."
                multiline
              />
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                No file attached — enter the order's details by hand instead.
              </p>
              <PoManualEntryFields
                details={addPoDetails}
                onDetailsChange={setAddPoDetails}
                orderNoEditable
                buyerNameEditable={addPoBuyerEditable}
                items={addPoItems}
                onItemsChange={setAddPoItems}
              />
            </>
          )}

          <button
            className="btn-primary w-full"
            onClick={() => void saveAddPoModal()}
            disabled={addPoBusy}
          >
            {addPoBusy ? "Saving…" : "Add PO"}
          </button>
        </div>
      </EditModal>

      <EditModal
        open={reviewModalTarget !== null}
        title={
          reviewModalTarget
            ? reviewModalTitle(reviewModalTarget, reviewModalAction)
            : "Review"
        }
        onClose={() => setReviewModalTarget(null)}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Add a review note. This is saved on the document version for the
            audit trail.
          </p>
          <ModalField
            label="Review remarks"
            value={reviewRemarkDraft}
            onChange={setReviewRemarkDraft}
            placeholder={
              reviewModalTarget
                ? reviewRemarkPlaceholder(reviewModalTarget, reviewModalAction)
                : "Add a review note…"
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

      <ConfirmDialog
        open={showDeletePoConfirm}
        title="Delete this PO version?"
        description={`This removes "${selectedPo ? poDocumentDisplayName(selectedPo, undefined, "Untitled") : "this PO"}" from the job. This can't be undone.`}
        confirmLabel="Delete"
        tone="danger"
        busy={deletePoBusy}
        error={deletePoError}
        onConfirm={deleteSelectedPo}
        onClose={() => {
          if (!deletePoBusy) setShowDeletePoConfirm(false);
        }}
      />

      <ConfirmDialog
        open={showDeleteDrawingConfirm}
        title="Delete this drawing revision?"
        description={`This removes "${selectedDrawing?.documentName || "this drawing"}" from the job. This can't be undone.`}
        confirmLabel="Delete"
        tone="danger"
        busy={deleteDrawingBusy}
        error={deleteDrawingError}
        onConfirm={deleteSelectedDrawing}
        onClose={() => {
          if (!deleteDrawingBusy) setShowDeleteDrawingConfirm(false);
        }}
      />
    </>
  );
}
