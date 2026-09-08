"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { downloadJobDocument } from "@/lib/frp/api";
import type { JobFileRecord } from "@/lib/jobFilesSort";
import { getFilePreviewKind } from "@/lib/jobFileThumbnail";

/**
 * In-app preview for a job document. PDFs render in the browser's own viewer
 * (which scrolls multi-page documents and brings its own zoom/search), images
 * render as a plain <img>. Anything else falls back to a download prompt.
 *
 * Both go through `/api/documents/preview`, because the signed SharePoint URL
 * is `Content-Disposition: attachment` and would otherwise just download.
 */

/** File kinds we can show inline; everything else gets the download fallback. */
export function isPreviewableFile(file: JobFileRecord): boolean {
  if (file.isManualEntry) return false;
  if (file.storageStatus === "PENDING" || file.storageStatus === "FAILED") {
    return false;
  }
  if (file.documentId == null) return false;
  const kind = getFilePreviewKind(file.name);
  return kind === "pdf" || kind === "image";
}

export function DocumentPreviewModal({
  file,
  onClose,
  onDownload,
}: {
  /** The document to preview; `null` closes the modal. */
  file: JobFileRecord | null;
  onClose: () => void;
  onDownload: (file: JobFileRecord) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documentId = file?.documentId ?? null;
  const fileName = file?.name ?? "";

  useEffect(() => {
    if (documentId == null) {
      setPreviewUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setPreviewUrl(null);
    setError(null);
    (async () => {
      try {
        const res = await downloadJobDocument(documentId);
        if (cancelled) return;
        if (!res.downloadUrl) {
          setError("This document has no file attached.");
          return;
        }
        const proxied = `/api/documents/preview?url=${encodeURIComponent(
          res.downloadUrl
        )}&name=${encodeURIComponent(fileName)}`;
        setPreviewUrl(proxied);
      } catch (e) {
        // Surface the backend's reason verbatim — "SharePoint is not configured
        // for this organization" and "still uploading" need different fixes,
        // and a generic message sends people looking in the wrong place.
        if (!cancelled) {
          setError(
            e instanceof Error && e.message
              ? e.message
              : "Could not load this document."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, fileName]);

  useEffect(() => {
    if (!file) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // Locking body alone isn't enough: once body has no room to scroll, wheel
    // input at the PDF/image's edge chains up to the <html> root instead, so
    // the job page behind the modal scrolls. Lock both.
    const html = document.documentElement;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
    };
  }, [file, onClose]);

  if (!file) return null;

  const kind = getFilePreviewKind(file.name);

  let body: React.ReactNode;
  if (error) {
    body = (
      // No "Download instead" here on purpose: download resolves the same
      // signed URL through the same endpoint, so it fails identically.
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileText className="h-8 w-8 text-slate-400" aria-hidden />
        <p className="max-w-md text-sm font-semibold text-slate-700">{error}</p>
        <p className="max-w-md text-xs text-slate-500">
          Downloading this document will fail for the same reason.
        </p>
      </div>
    );
  } else if (!previewUrl) {
    body = (
      <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading preview…
      </div>
    );
  } else if (kind === "image") {
    body = (
      // Scrolls when the image is larger than the panel, same as the PDF view.
      // overscroll-contain stops the scroll from chaining to the page behind
      // the modal once the image hits its edge.
      <div className="h-full overflow-auto overscroll-contain p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={file.name}
          className="mx-auto max-w-full rounded-lg shadow-sm"
        />
      </div>
    );
  } else if (kind === "pdf") {
    body = (
      <iframe
        src={previewUrl}
        title={file.name}
        className="h-full w-full rounded-lg border-0 bg-white"
      />
    );
  } else {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <FileText className="h-8 w-8 text-slate-400" aria-hidden />
        <p className="text-sm font-semibold text-slate-700">
          Preview is not available for this file type.
        </p>
        <button
          type="button"
          className="mt-1 text-sm font-semibold text-orange-700 hover:text-orange-800"
          onClick={() => onDownload(file)}
        >
          Download to open →
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${file.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-[#111827]">
              {file.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {file.category} · {file.time}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={error != null}
              title={error != null ? error : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:border-orange-200 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#E5E7EB] disabled:hover:text-slate-800"
              onClick={() => onDownload(file)}
            >
              <Download className="h-4 w-4 text-orange-600" aria-hidden />
              Download
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-slate-600 hover:border-orange-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFBFC]">
          {body}
        </div>
      </div>
    </div>
  );
}
