export interface WorkerCertification {
  label: string;
}

export interface FloorWorker {
  id: string;
  name: string;
  initials: string;
  certifications: WorkerCertification[];
  assignedJobs: string[];
  hoursUsed: number;
  hoursCapacity: number;
  absent?: boolean;
}

export const floorHealthSummary = {
  capacityUtilization: 92,
  absenceNote: "1 Absence (Mike T.)",
  coverageNote: "All critical jobs covered",
};

export const floorWorkers: FloorWorker[] = [
  {
    id: "w1",
    name: "M. Henderson",
    initials: "MH",
    certifications: [{ label: "ISO" }, { label: "Vinyl Ester" }],
    assignedJobs: ["JOB-031", "JOB-030"],
    hoursUsed: 7.5,
    hoursCapacity: 8,
  },
  {
    id: "w2",
    name: "S. Patel",
    initials: "SP",
    certifications: [{ label: "Vinyl Ester" }, { label: "Phenolic" }],
    assignedJobs: ["JOB-028"],
    hoursUsed: 6,
    hoursCapacity: 8,
  },
  {
    id: "w3",
    name: "Mike T.",
    initials: "MT",
    certifications: [{ label: "ISO" }],
    assignedJobs: [],
    hoursUsed: 0,
    hoursCapacity: 8,
    absent: true,
  },
  {
    id: "w4",
    name: "J. Morrison",
    initials: "JM",
    certifications: [{ label: "ISO" }, { label: "Vinyl Ester" }],
    assignedJobs: ["JOB-027", "JOB-025"],
    hoursUsed: 8,
    hoursCapacity: 8,
  },
  {
    id: "w5",
    name: "T. Williams",
    initials: "TW",
    certifications: [{ label: "ISO" }],
    assignedJobs: ["JOB-026", "JOB-031"],
    hoursUsed: 9.5,
    hoursCapacity: 8,
  },
];

export function getCapacityStatus(worker: FloorWorker): "normal" | "warning" | "overtime" {
  if (worker.absent) return "normal";
  const ratio = worker.hoursUsed / worker.hoursCapacity;
  if (ratio > 1) return "overtime";
  if (ratio >= 0.9) return "warning";
  return "normal";
}
