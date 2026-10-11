import type { JobStatus } from "@/lib/types";

export const STATUS_THEME = {
  notStarted: {
    strong: "#EF4444",
    soft: "#FCA5A5",
    tint: "#FEF2F2",
  },
  manufacturing: {
    strong: "#F59E0B",
    soft: "#FCD34D",
    tint: "#FFFBEB",
  },
  delivered: {
    strong: "#10B981",
    soft: "#6EE7B7",
    tint: "#ECFDF5",
  },
} as const;

export type StatusBucket = keyof typeof STATUS_THEME;

export function statusToBucket(status: JobStatus): StatusBucket {
  if (status === "Complete") return "delivered";
  if (status === "In Fabrication") return "manufacturing";
  return "notStarted";
}

export function statusColor(status: JobStatus) {
  return STATUS_THEME[statusToBucket(status)];
}
