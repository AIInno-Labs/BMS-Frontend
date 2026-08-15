"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  PenLine,
  Plus,
} from "lucide-react";
import {
  JOB_FILE_SORT_OPTIONS,
  type JobFileRecord,
  type JobFileSortMode,
} from "@/lib/jobFilesSort";
import {
  fileExtensionLabel,
  getFilePreviewKind,
  getFileThumbnailStyle,
} from "@/lib/jobFileThumbnail";

function isVersionsDocument(file: JobFileRecord): boolean {
  return file.documentType === "PRODUCTION" || file.documentType === "DRAWING";
}

interface JobFilesDocumentStripProps {
  jobId: string;
  files: JobFileRecord[];
  fileSort: JobFileSortMode;
  onFileSortChange: (mode: JobFileSortMode) => void;
  onUpload: () => void;
  onDownload: (file: JobFileRecord) => void;
  /** PO / drawing clicks — parent scrolls to Document Versions. */
  onOpenFile?: (file: JobFileRecord) => void;
  /** Detail-panel "Download" for versioned PO/drawing docs — always fetches
   *  the file itself, unlike `onOpenFile` which navigates to Document
   *  Versions. Falls back to `onDownload` if not provided. */
  onDownloadVersionFile?: (file: JobFileRecord) => void;
  /** Full-width “Project documents” row vs compact Files widget */
  variant?: "full" | "compact";
}

function PreviewIcon({ kind }: { kind: ReturnType<typeof getFilePreviewKind> }) {
  const className = "h-9 w-9 text-white/95 drop-shadow-sm";
  switch (kind) {
    case "image":
      return <FileImage className={className} aria-hidden />;
    case "drawing":
      return <PenLine className={className} aria-hidden />;
    case "document":
      return <FileSpreadsheet className={className} aria-hidden />;
    default:
      return <FileText className={className} aria-hidden />;
  }
}

function FileThumbnailTile({
  file,
  selected,
  onSelect,
}: {
  file: JobFileRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = getFileThumbnailStyle(file);
  const ext = fileExtensionLabel(file.name);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative shrink-0 rounded-xl border bg-white p-2.5 text-left transition-all ${
        selected
          ? "border-orange-300 ring-2 ring-orange-200/70 shadow-md"
          : "border-[#E5E7EB] hover:border-orange-200 hover:shadow-sm"
      }`}
      aria-pressed={selected}
      aria-label={
        isVersionsDocument(file)
          ? `Open ${file.name} in Document Versions`
          : `${file.name}, ${file.category}. Click to open.`
      }
    >
      {file.isManualEntry ? (
        <span
          title="Manually entered — no file attached"
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold leading-none text-white shadow-sm"
        >
          <span aria-hidden>M</span>
          <span className="sr-only">Manually entered — no file attached</span>
        </span>
      ) : null}
      <div
        className={`flex h-[88px] w-[88px] flex-col items-center justify-center rounded-lg bg-gradient-to-br ${style.bg} shadow-inner`}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-md shadow-sm"
          style={{ backgroundColor: style.accent }}
        >
          <PreviewIcon kind={style.kind} />
        </div>
        <span className="mt-1.5 text-[9px] font-bold tracking-wider text-slate-600">
          {ext}
        </span>
      </div>
      <p className="mt-2 max-w-[88px] truncate text-center text-[10px] font-semibold text-slate-700">
        {file.name}
      </p>
    </button>
  );
}

function fileKey(file: JobFileRecord): string {
  return file.documentId != null
    ? `doc-${file.documentId}`
    : `${file.name}-${file.uploadedAt ?? file.time}`;
}

export function JobFilesDocumentStrip({
  jobId,
  files,
  fileSort,
  onFileSortChange,
  onUpload,
  onDownload,
  onOpenFile,
  onDownloadVersionFile,
  variant = "full",
}: JobFilesDocumentStripProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedFile = useMemo(() => {
    if (files.length === 0) return null;
    return files.find((f) => fileKey(f) === selectedKey) ?? files[0];
  }, [files, selectedKey]);

  useEffect(() => {
    if (variant === "compact") return;
    if (files.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !files.some((f) => fileKey(f) === selectedKey)) {
      setSelectedKey(fileKey(files[0]));
    }
  }, [files, selectedKey, variant]);

  const sortControl = (
    <label className="inline-flex min-w-0 items-center">
      <span className="sr-only">Sort files</span>
      <select
        value={fileSort}
        onChange={(e) => onFileSortChange(e.target.value as JobFileSortMode)}
        className="max-w-[6.5rem] cursor-pointer rounded-md border border-[#E5E7EB] bg-white py-1 pl-2 pr-6 text-[10px] font-semibold uppercase tracking-wide text-slate-600 outline-none hover:border-orange-200 focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
        aria-label="Sort files"
      >
        {JOB_FILE_SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );

  const thumbnailRow = (
    <div className="flex flex-wrap items-start gap-3 overflow-x-auto overscroll-contain pb-1">
      {files.map((file) => (
        <FileThumbnailTile
          key={fileKey(file)}
          file={file}
          selected={variant !== "compact" && selectedFile != null && fileKey(selectedFile) === fileKey(file)}
          onSelect={() => {
            if (isVersionsDocument(file) && onOpenFile) {
              if (variant !== "compact") setSelectedKey(fileKey(file));
              onOpenFile(file);
              return;
            }
            if (variant === "compact") {
              onDownload(file);
              return;
            }
            setSelectedKey(fileKey(file));
          }}
        />
      ))}
      <button
        type="button"
        onClick={onUpload}
        className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-orange-200 bg-orange-50/60 text-orange-700 transition-colors hover:border-orange-300 hover:bg-orange-50"
        aria-label="Upload file"
      >
        <Plus className="h-6 w-6" aria-hidden />
        <span className="mt-1 text-[10px] font-semibold">Upload</span>
      </button>
    </div>
  );

  const detailPanel = selectedFile ? (
    <div className="min-w-[200px] flex-1 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
      <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
      <p className="mt-1 text-xs text-slate-500">
        {selectedFile.category} · {selectedFile.time}
      </p>
      <p className="mt-1 text-xs text-slate-500">Job {jobId}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isVersionsDocument(selectedFile) && onOpenFile ? (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:border-orange-200 hover:text-orange-700"
              onClick={() => onOpenFile(selectedFile)}
            >
              View version →
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:border-orange-200 hover:text-orange-700"
              onClick={() => (onDownloadVersionFile ?? onDownload)(selectedFile)}
            >
              <Download className="h-4 w-4 text-orange-600" aria-hidden />
              Download
            </button>
          </>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:border-orange-200 hover:text-orange-700"
            onClick={() => onDownload(selectedFile)}
          >
            <Download className="h-4 w-4 text-orange-600" aria-hidden />
            Download
          </button>
        )}
        <button
          type="button"
          className="text-sm font-semibold text-orange-700 hover:text-orange-800"
          onClick={onUpload}
        >
          Upload another →
        </button>
      </div>
    </div>
  ) : (
    <div className="min-w-[200px] flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
      <p className="text-sm font-semibold text-slate-700">No files uploaded</p>
      <p className="mt-1 text-xs text-slate-500">
        Add specifications, drawings, POs, or QA documents for this job.
      </p>
      <button
        type="button"
        className="mt-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
        onClick={onUpload}
      >
        Upload file →
      </button>
    </div>
  );

  if (variant === "compact") {
    return thumbnailRow;
  }

  return (
    <article className="app-card-interactive p-4 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <FileText className="h-4 w-4 text-[#F97316]" />
          Project documents
        </p>
        {sortControl}
      </div>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">{thumbnailRow}</div>
        <div className="w-full shrink-0 lg:max-w-sm">{detailPanel}</div>
      </div>
    </article>
  );
}
