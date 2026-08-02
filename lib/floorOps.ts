import type { FloorWorker } from "@/lib/laborMock";
import type { Job } from "@/lib/types";
import type { ScheduleEntry } from "@/lib/jobData";
import { completionPercentForJob } from "@/lib/jobData";

export interface DbStaffRow {
  id: string;
  display_name: string;
  initials: string;
  certifications: string[];
  shift_hours_capacity: number;
  is_present: boolean;
}

export interface FloorHealthSnapshot {
  capacityUtilization: number;
  onFloorCount: number;
  absentCount: number;
  absenceNote: string | null;
  coverageNote: string;
  absentWorker: { name: string; queuedJobs: number } | null;
  overtimeWorker: {
    name: string;
    hoursUsed: number;
    hoursCapacity: number;
    bayDoneLabel: string;
  } | null;
}

const ACTIVE_STATUSES: Job["status"][] = [
  "Pending",
  "Awaiting Manager Approval",
  "Ready to Manufacture",
  "In Fabrication",
  "On Hold",
];

function isActiveFloorJob(job: Job): boolean {
  return ACTIVE_STATUSES.includes(job.status);
}

/** Today's shift booking — not total program hours across multi-day work. */
function shiftHoursForJob(job: Job): number {
  const program = job.estimatedHours ?? 4;
  switch (job.status) {
    case "In Fabrication":
      return Math.min(program * 0.35, 2.5);
    case "Ready to Manufacture":
      return job.priority === "RUSH" ? 2 : 1.25;
    case "On Hold":
      return 0.75;
    case "Awaiting Manager Approval":
      return 0.5;
    case "Pending":
      return 0.25;
    default:
      return 0;
  }
}

function jobPriorityRank(job: Job): number {
  if (job.priority === "RUSH") return 0;
  if (job.status === "In Fabrication") return 1;
  if (job.status === "Ready to Manufacture") return 2;
  return 3;
}

function shiftHoursForWorker(name: string, activeJobs: Job[]): number {
  const booked = activeJobs
    .filter((j) => j.assignedWorkerName === name)
    .sort((a, b) => jobPriorityRank(a) - jobPriorityRank(b))
    .slice(0, 4)
    .reduce((sum, j) => sum + shiftHoursForJob(j), 0);

  return Math.round(booked * 10) / 10;
}

function certLabelForResin(resin: Job["resinType"]): string {
  if (resin === "Vinyl Ester") return "Vinyl Ester";
  if (resin === "Phenolic") return "Phenolic";
  return "IsoFR";
}

function estimateBayDoneLabel(hoursUsed: number, hoursCapacity: number): string {
  const now = new Date();
  const overtimeHours = Math.max(0, hoursUsed - hoursCapacity);
  const done = new Date(now.getTime() + overtimeHours * 60 * 60 * 1000 + 30 * 60 * 1000);
  return done.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function buildFloorWorkers(
  staff: DbStaffRow[],
  jobs: Job[]
): FloorWorker[] {
  const activeJobs = jobs.filter(isActiveFloorJob);

  return staff.map((member) => {
    const assignedJobs = activeJobs
      .filter((j) => j.assignedWorkerName === member.display_name)
      .map((j) => j.id);

    const hoursUsed = shiftHoursForWorker(member.display_name, activeJobs);

    const certs =
      member.certifications.length > 0
        ? member.certifications.map((label) => ({ label }))
        : [{ label: "IsoFR" }];

    return {
      id: member.id,
      name: member.display_name,
      initials: member.initials,
      certifications: certs,
      assignedJobs,
      hoursUsed: member.is_present ? hoursUsed : 0,
      hoursCapacity: Number(member.shift_hours_capacity) || 8,
      absent: !member.is_present,
    };
  });
}

export function buildFloorHealth(
  staff: DbStaffRow[],
  workers: FloorWorker[],
  jobs: Job[]
): FloorHealthSnapshot {
  const present = staff.filter((s) => s.is_present);
  const absent = staff.filter((s) => !s.is_present);
  const onFloor = present.length;

  const totalCapacity = present.reduce(
    (sum, s) => sum + (Number(s.shift_hours_capacity) || 8),
    0
  );
  const totalUsed = workers
    .filter((w) => !w.absent)
    .reduce((sum, w) => sum + w.hoursUsed, 0);

  const capacityUtilization =
    totalCapacity > 0
      ? Math.min(100, Math.round((totalUsed / totalCapacity) * 100))
      : 0;

  const absentStaff = absent[0];
  const absentWorker = absentStaff
    ? {
        name: absentStaff.display_name,
        queuedJobs: jobs.filter(
          (j) =>
            isActiveFloorJob(j) &&
            j.assignedWorkerName === absentStaff.display_name
        ).length,
      }
    : null;

  const overtime = workers
    .filter((w) => !w.absent && w.hoursUsed > w.hoursCapacity)
    .sort((a, b) => b.hoursUsed - a.hoursUsed)[0];

  const overtimeWorker = overtime
    ? {
        name: overtime.name,
        hoursUsed: overtime.hoursUsed,
        hoursCapacity: overtime.hoursCapacity,
        bayDoneLabel: estimateBayDoneLabel(
          overtime.hoursUsed,
          overtime.hoursCapacity
        ),
      }
    : null;

  const uncovered = jobs.filter(
    (j) =>
      isActiveFloorJob(j) &&
      j.priority === "RUSH" &&
      (!j.assignedWorkerName ||
        absent.some((a) => a.display_name === j.assignedWorkerName))
  ).length;

  return {
    capacityUtilization,
    onFloorCount: onFloor,
    absentCount: absent.length,
    absenceNote:
      absent.length > 0
        ? `${absent.length} Absence${absent.length > 1 ? "s" : ""} (${absent.map((a) => a.display_name.split(" ").pop()).join(", ")})`
        : null,
    coverageNote:
      uncovered > 0
        ? `${uncovered} RUSH job${uncovered > 1 ? "s" : ""} need reassignment`
        : "All critical jobs covered",
    absentWorker,
    overtimeWorker,
  };
}

/** Reassign jobs off absent fabricators onto present staff with lowest load. */
export function computeRebalancedAssignments(
  staff: DbStaffRow[],
  jobs: Job[]
): Map<string, string> {
  const present = staff.filter((s) => s.is_present);
  const absentNames = new Set(
    staff.filter((s) => !s.is_present).map((s) => s.display_name)
  );

  if (!present.length) return new Map();

  const load = new Map<string, number>(
    present.map((s) => [s.display_name, 0])
  );

  const updates = new Map<string, string>();

  const activeJobs = [...jobs]
    .filter(isActiveFloorJob)
    .sort((a, b) => {
      if (a.priority === "RUSH" && b.priority !== "RUSH") return -1;
      if (b.priority === "RUSH" && a.priority !== "RUSH") return 1;
      return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    });

  for (const job of activeJobs) {
    const current = job.assignedWorkerName;
    const needsReassign =
      !current ||
      absentNames.has(current) ||
      (job.priority === "RUSH" && absentNames.has(current));

    if (!needsReassign && current) {
      load.set(current, (load.get(current) ?? 0) + shiftHoursForJob(job));
      continue;
    }

    const target = [...present].sort((a, b) => {
      const la = load.get(a.display_name) ?? 0;
      const lb = load.get(b.display_name) ?? 0;
      if (la !== lb) return la - lb;
      return a.display_name.localeCompare(b.display_name);
    })[0];

    if (!target) continue;

    updates.set(job.id, target.display_name);
    load.set(
      target.display_name,
      (load.get(target.display_name) ?? 0) + shiftHoursForJob(job)
    );
  }

  return updates;
}

export function buildScheduleAfterRebalance(
  jobs: Job[],
  assignmentUpdates: Map<string, string>
): ScheduleEntry[] {
  const merged = jobs.map((job) => {
    const name = assignmentUpdates.get(job.id) ?? job.assignedWorkerName;
    return {
      ...job,
      assignedWorkerName: name ?? job.assignedWorkerName,
    };
  });

  return [...merged]
    .filter((j) => j.status !== "Cancelled" && j.status !== "Complete")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 24)
    .map((job) => ({
      estimatedDate: job.dueDate ?? job.quoteValidUntil ?? "",
      jobCode: job.id,
      assignedTo: job.assignedWorkerName?.trim() || "Unassigned",
      completionPercent: completionPercentForJob(job),
    }));
}
