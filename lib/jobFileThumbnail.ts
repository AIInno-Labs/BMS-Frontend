import type { JobFileRecord } from "@/lib/jobFilesSort";

export type FilePreviewKind = "pdf" | "image" | "drawing" | "document" | "other";

export function getFilePreviewKind(name: string): FilePreviewKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (["dwg", "dxf", "step", "stp"].includes(ext)) return "drawing";
  if (["doc", "docx", "xls", "xlsx"].includes(ext)) return "document";
  return "other";
}

const CATEGORY_STYLES: Record<string, { bg: string; accent: string }> = {
  Specification: { bg: "from-slate-100 to-slate-50", accent: "#64748b" },
  Drawing: { bg: "from-blue-50 to-indigo-50", accent: "#2563eb" },
  "Purchase Order": { bg: "from-emerald-50 to-teal-50", accent: "#059669" },
  "QA Document": { bg: "from-violet-50 to-purple-50", accent: "#7c3aed" },
  Delivery: { bg: "from-amber-50 to-orange-50", accent: "#ea580c" },
  Other: { bg: "from-slate-100 to-slate-50", accent: "#64748b" },
};

export function getFileThumbnailStyle(file: JobFileRecord) {
  const kind = getFilePreviewKind(file.name);
  const cat = CATEGORY_STYLES[file.category] ?? CATEGORY_STYLES.Other;
  return { kind, ...cat };
}

export function fileExtensionLabel(name: string): string {
  const ext = name.split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}
