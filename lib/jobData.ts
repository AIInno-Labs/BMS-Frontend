import type { Job, JobStatus, ResinType } from "./types";

export interface ScheduleEntry {
  estimatedDate: string;
  jobCode: string;
  assignedTo: string;
  completionPercent: number;
}

export const resinTypes: ResinType[] = [
  "Isophthalic Polyester",
  "Vinyl Ester",
  "Phenolic",
];

export const jobStatuses: JobStatus[] = [
  "Pending",
  "Awaiting Manager Approval",
  "Ready to Manufacture",
  "In Fabrication",
  "On Hold",
  "Complete",
  "Cancelled",
];

export const jobPriorities: Job["priority"][] = ["Normal", "High", "RUSH"];

export function isReadyToManufacture(job: Job): boolean {
  return job.status === "Ready to Manufacture";
}

export function hasSchedulingBlockAlert(job: Job): boolean {
  if (!job.alert) return false;
  const lower = job.alert.toLowerCase();
  return (
    lower.includes("pending") ||
    lower.includes("low resin") ||
    lower.includes("inventory") ||
    lower.includes("stock")
  );
}

export function formatEstimatedHours(hours: number | null): string {
  if (hours == null) return "—";
  return `${hours} hrs`;
}

export function formatEstimatedHoursLong(hours: number | null): string {
  if (hours == null) return "Not estimated";
  return `${hours} hours`;
}

export function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function getReadyToManufactureChartData(jobList: Job[]) {
  const yes = jobList.filter(isReadyToManufacture).length;
  const no = jobList.length - yes;
  return [
    { name: "Yes", value: yes, fill: "#2563eb" },
    { name: "No", value: no, fill: "#cbd5e1" },
  ];
}

export function formatDate(isoDate: string | null | undefined): string {
  const trimmed = isoDate?.trim();
  if (!trimmed) return "—";
  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(isoDate: string | null | undefined): string {
  const trimmed = isoDate?.trim();
  if (!trimmed) return "—";
  const d = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Job record created timestamp (Spring Boot `createdDate`). */
export function formatCreatedDate(createdAt: string | undefined): string {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function completionPercentForJob(job: Job): number {
  switch (job.status) {
    case "Complete":
      return 100;
    case "In Fabrication":
      return 55;
    case "Ready to Manufacture":
      return 15;
    case "Awaiting Manager Approval":
    case "Pending":
      return 0;
    case "On Hold":
      return 25;
    default:
      return 0;
  }
}

/** Whiteboard schedule rows derived from live jobs (no mock job list). */
export function buildScheduleFromJobs(
  jobs: Job[],
  limit = 24
): ScheduleEntry[] {
  return [...jobs]
    .filter((j) => j.status !== "Cancelled" && j.status !== "Complete")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, limit)
    .map((job) => ({
      estimatedDate: job.dueDate ?? job.quoteValidUntil ?? "",
      jobCode: job.id,
      assignedTo: job.assignedWorkerName?.trim() || "Unassigned",
      completionPercent: completionPercentForJob(job),
    }));
}
