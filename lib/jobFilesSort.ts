export type JobFileRecord = {
  name: string;
  category: string;
  time: string;
  uploadedAt?: number;
  /** Backend document id when the row came from `GET /jobs/{id}/documents`. */
  documentId?: number;
  /** Backend `documentType` — PRODUCTION / DRAWING open in Document Versions. */
  documentType?: "DRAWING" | "PRODUCTION" | "QC" | "OTHER";
  /** PO entered by hand with no file attached (see `isManualPoDocument`). */
  isManualEntry?: boolean;
  /** Backend review status — mirrors `FrpDocumentStatus`. */
  reviewStatus?: "ACTIVE" | "ACCEPTED" | "REJECTED";
};

export type JobFileSortMode = "recents" | "newest" | "name" | "category";

export const JOB_FILE_SORT_OPTIONS: { value: JobFileSortMode; label: string }[] = [
  { value: "recents", label: "Recents" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "A to Z" },
  { value: "category", label: "Category" },
];

/** Parse demo time labels into a sortable timestamp (ms). */
export function fileRecencyTimestamp(file: JobFileRecord): number {
  if (typeof file.uploadedAt === "number" && Number.isFinite(file.uploadedAt)) {
    return file.uploadedAt;
  }
  const t = file.time.trim().toLowerCase();
  const now = Date.now();
  if (t === "just now") return now;
  if (t === "attached") return now - 365 * 24 * 60 * 60 * 1000;
  const rel = t.match(/^(\d+)\s*(m|h|d)\s*ago$/);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    const ms =
      unit === "m" ? n * 60_000 : unit === "h" ? n * 3_600_000 : n * 86_400_000;
    return now - ms;
  }
  return now - 86_400_000;
}

export function normalizeJobFiles(files: JobFileRecord[]): JobFileRecord[] {
  return files.map((file, index) => ({
    ...file,
    uploadedAt: file.uploadedAt ?? fileRecencyTimestamp(file) - index,
  }));
}

export function sortJobFiles(
  files: JobFileRecord[],
  mode: JobFileSortMode
): JobFileRecord[] {
  const list = normalizeJobFiles([...files]);

  switch (mode) {
    case "newest":
      return list.sort((a, b) => fileRecencyTimestamp(b) - fileRecencyTimestamp(a));
    case "recents": {
      return list.sort((a, b) => {
        const tb = fileRecencyTimestamp(b);
        const ta = fileRecencyTimestamp(a);
        if (tb !== ta) return tb - ta;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    }
    case "name":
      return list.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    case "category":
      return list.sort((a, b) => {
        const cat = a.category.localeCompare(b.category, undefined, {
          sensitivity: "base",
        });
        if (cat !== 0) return cat;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    default:
      return list;
  }
}
