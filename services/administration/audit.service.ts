import {
  AUDIT_LOGS,
  AUDIT_ACTION_FILTERS,
  AUDIT_DATE_RANGES,
} from "@/constants/administration/auditLogs";
import type { AuditAction, AuditLogEntry } from "@/lib/administration/types";

export interface GetAuditLogsParams {
  query?: string;
  action?: (typeof AUDIT_ACTION_FILTERS)[number];
}

export function getAuditLogs(params: GetAuditLogsParams = {}): Promise<AuditLogEntry[]> {
  const { query = "", action = "All Actions" } = params;
  const q = query.trim().toLowerCase();

  const filtered = AUDIT_LOGS.filter((entry) => {
    if (action !== "All Actions" && entry.action !== (action as AuditAction)) return false;
    if (!q) return true;
    return (
      entry.userName.toLowerCase().includes(q) ||
      entry.targetLabel.toLowerCase().includes(q) ||
      entry.action.toLowerCase().includes(q)
    );
  });

  return Promise.resolve(filtered);
}

export function getAuditActionFilters(): Promise<readonly string[]> {
  return Promise.resolve(AUDIT_ACTION_FILTERS);
}

export function getAuditDateRanges(): Promise<readonly string[]> {
  return Promise.resolve(AUDIT_DATE_RANGES);
}
