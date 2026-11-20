import type { JobFileRecord } from "@/lib/jobFilesSort";

/**
 * The folders on the job detail page's Project documents card, in workflow
 * order. A file's folder is the stage it was uploaded to (the "Select folder…"
 * choice in the upload dialog), so the card mirrors what the user picked.
 *
 * `stageKey` is the job-stage key the folder corresponds to; it is how the
 * upload dialog preselects the right folder from a tab.
 */
export type JobFileFolder =
  | "drawing"
  | "approval"
  | "production"
  | "qc"
  | "dispatch"
  | "others";

export const JOB_FILE_FOLDERS: {
  key: JobFileFolder;
  label: string;
  stageKey?: string;
}[] = [
  { key: "drawing", label: "Drawing", stageKey: "design" },
  { key: "approval", label: "Approval", stageKey: "approval" },
  { key: "production", label: "Production / PO", stageKey: "production" },
  { key: "qc", label: "QC", stageKey: "qc" },
  { key: "dispatch", label: "Dispatch", stageKey: "dispatch" },
  { key: "others", label: "Others" },
];

const FOLDER_BY_STAGE_KEY: Record<string, JobFileFolder> = {
  design: "drawing",
  approval: "approval",
  production: "production",
  qc: "qc",
  dispatch: "dispatch",
};

/** Backend `documentType` values that name a folder directly. Today the backend
 *  only sends DRAWING / PRODUCTION / QC / OTHER (Approval and Dispatch files
 *  come through as OTHER, told apart by their stage); APPROVAL and DISPATCH are
 *  accepted here so a later backend type needs no frontend change. */
const FOLDER_BY_DOCUMENT_TYPE: Record<string, JobFileFolder> = {
  DRAWING: "drawing",
  APPROVAL: "approval",
  PRODUCTION: "production",
  QC: "qc",
  DISPATCH: "dispatch",
};

/** Which folder a file belongs to: its stage first, then its document type,
 *  otherwise Others. */
export function fileFolder(
  file: Pick<JobFileRecord, "documentType" | "milestoneStageKey">
): JobFileFolder {
  const byStage = file.milestoneStageKey
    ? FOLDER_BY_STAGE_KEY[file.milestoneStageKey.trim().toLowerCase()]
    : undefined;
  if (byStage) return byStage;
  const byType = file.documentType
    ? FOLDER_BY_DOCUMENT_TYPE[String(file.documentType).toUpperCase()]
    : undefined;
  return byType ?? "others";
}
