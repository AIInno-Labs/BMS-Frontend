import type { JobAuditEntry, JobAuditIcon } from "@/lib/audit/job-audit-types";

export const QUOTIENT_EVENT_AUDIT_LABELS: Record<string, string> = {
  quote_sent: "System: Quote sent via Quotient webhook",
  customer_viewed: "Customer viewed quote",
  customer_question: "Customer question received",
  quote_accepted: "Quote accepted — factory job created",
  quote_declined: "Quote declined",
  quote_completed: "Quote marked complete in Quotient",
};

export function quotientEventToAuditEntry(row: {
  id: string;
  event_name: string;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
}): JobAuditEntry {
  const label =
    QUOTIENT_EVENT_AUDIT_LABELS[row.event_name] ?? `Quotient: ${row.event_name}`;

  let title = label;
  let icon: JobAuditIcon = "clock";

  if (row.event_name === "quote_accepted" || row.event_name === "quote_completed") {
    icon = "check";
  } else if (row.event_name === "quote_declined") {
    icon = "warn";
  }

  if (row.processing_status === "failed") {
    icon = "warn";
    title = `${label} (processing failed)`;
    if (row.processing_error) {
      title += ` — ${row.processing_error}`;
    }
  } else if (row.processing_status !== "processed") {
    title = `${label} (${row.processing_status})`;
  }

  return {
    id: `evt-${row.id}`,
    icon,
    title,
    timestamp: formatAuditWhen(row.created_at),
    at: row.created_at,
  };
}

export function formatAuditWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
