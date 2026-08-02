export type JobAuditIcon = "clock" | "ai" | "check" | "warn";

export interface JobAuditEntry {
  id: string;
  icon: JobAuditIcon;
  title: string;
  timestamp: string;
  /** ISO sort key */
  at: string;
}
