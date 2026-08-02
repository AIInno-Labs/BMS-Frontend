"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, GripVertical } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { AiButton } from "@/components/ai/AiButton";
import { buildScheduleFromJobs } from "@/lib/jobData";
import { buildFloorHealth, buildFloorWorkers } from "@/lib/floorOps";
import { useJobs } from "@/context/JobsContext";
import { getCapacityStatus, type FloorWorker } from "@/lib/laborMock";
import { formatShortDate } from "@/lib/mockData";
import type { ScheduleEntry } from "@/lib/mockData";

interface LaborCommandCenterDrawerProps {
  open: boolean;
  onClose: () => void;
  focusRebalance?: boolean;
}

function CertificationBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-base font-medium text-slate-700">
      [{label}]
    </span>
  );
}

function ShiftCapacityBar({ worker }: { worker: FloorWorker }) {
  const status = getCapacityStatus(worker);
  const pct = worker.absent
    ? 0
    : Math.min(100, (worker.hoursUsed / worker.hoursCapacity) * 100);

  const barColor =
    status === "overtime"
      ? "bg-red-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-blue-600";

  const labelColor =
    status === "overtime"
      ? "text-red-700"
      : status === "warning"
        ? "text-amber-700"
        : "text-slate-600";

  if (worker.absent) {
    return (
      <p className="text-base font-medium text-slate-500">Absent today</p>
    );
  }

  return (
    <div className="w-full min-w-[140px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`text-base font-medium ${labelColor}`}>
          {worker.hoursUsed}/{worker.hoursCapacity} hrs
          {status === "overtime" && " — Overtime Risk"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function JobAssignmentPill({ jobId }: { jobId: string }) {
  return (
    <span
      className="inline-flex cursor-grab items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-base font-semibold text-slate-800 shadow-sm transition-all duration-150 ease-in-out hover:border-blue-300 hover:bg-blue-50 active:cursor-grabbing"
      title="Drag to reassign (demo)"
    >
      <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      {jobId}
    </span>
  );
}

const MAX_VISIBLE_JOB_PILLS = 5;

function WorkerRow({ worker }: { worker: FloorWorker }) {
  const status = getCapacityStatus(worker);
  const visibleJobs = worker.assignedJobs.slice(0, MAX_VISIBLE_JOB_PILLS);
  const overflowCount = worker.assignedJobs.length - visibleJobs.length;

  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm transition-all duration-150 ease-in-out ${
        worker.absent
          ? "border-slate-200 opacity-60"
          : status === "overtime"
            ? "border-red-200 bg-red-50"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-base font-bold ${
              worker.absent
                ? "border-slate-200 bg-slate-100 text-slate-500"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
            aria-hidden
          >
            {worker.initials}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-slate-900">
              {worker.name}
              {worker.absent && (
                <span className="ml-2 text-base font-medium text-slate-500">
                  (Absent)
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {worker.certifications.map((cert) => (
                <CertificationBadge key={cert.label} label={cert.label} />
              ))}
            </div>
          </div>
        </div>
        <div className="sm:w-44 sm:shrink-0">
          <ShiftCapacityBar worker={worker} />
        </div>
      </div>

      {worker.assignedJobs.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          {visibleJobs.map((jobId) => (
            <JobAssignmentPill key={jobId} jobId={jobId} />
          ))}
          {overflowCount > 0 && (
            <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-600">
              +{overflowCount} more
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export function LaborCommandCenterDrawer({
  open,
  onClose,
  focusRebalance = false,
}: LaborCommandCenterDrawerProps) {
  const { jobs, staff, rebalanceFloor } = useJobs();

  const floorWorkers = useMemo(
    () => buildFloorWorkers(staff, jobs),
    [staff, jobs]
  );

  const floorHealth = useMemo(
    () => buildFloorHealth(staff, floorWorkers, jobs),
    [staff, floorWorkers, jobs]
  );

  const baseSchedule = useMemo(() => buildScheduleFromJobs(jobs), [jobs]);
  const [rows, setRows] = useState<ScheduleEntry[]>(baseSchedule);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanced, setRebalanced] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const rebalanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoRebalanceDoneRef = useRef(false);

  const clearRebalanceTimeout = useCallback(() => {
    if (rebalanceTimeoutRef.current) {
      clearTimeout(rebalanceTimeoutRef.current);
      rebalanceTimeoutRef.current = null;
    }
  }, []);

  const handleRebalance = useCallback(() => {
    if (isRebalancing) return;

    clearRebalanceTimeout();
    setIsRebalancing(true);
    setStatusMessage(
      "AI is rebalancing floor assignments across certified fabricators..."
    );
    setRebalanced(false);

    rebalanceTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await rebalanceFloor();
          setRows(buildScheduleFromJobs(result.jobs));
          setIsRebalancing(false);
          setRebalanced(true);
          setStatusMessage(result.message);
        } catch (e) {
          setIsRebalancing(false);
          setRebalanced(false);
          setStatusMessage(
            e instanceof Error ? e.message : "Rebalance failed"
          );
        } finally {
          rebalanceTimeoutRef.current = null;
        }
      })();
    }, 1200);
  }, [clearRebalanceTimeout, isRebalancing, rebalanceFloor]);

  useEffect(() => {
    if (open) {
      setRows(baseSchedule);
      setRebalanced(false);
      setStatusMessage(null);
      setIsRebalancing(false);
      autoRebalanceDoneRef.current = false;
      clearRebalanceTimeout();
    }
    return () => clearRebalanceTimeout();
  }, [open, clearRebalanceTimeout, baseSchedule]);

  const handleRebalanceRef = useRef(handleRebalance);
  handleRebalanceRef.current = handleRebalance;

  useEffect(() => {
    if (!open || !focusRebalance || autoRebalanceDoneRef.current) return;
    autoRebalanceDoneRef.current = true;
    const timer = window.setTimeout(() => handleRebalanceRef.current(), 400);
    return () => window.clearTimeout(timer);
  }, [open, focusRebalance]);

  const { capacityUtilization, absenceNote, coverageNote } = {
    capacityUtilization: floorHealth.capacityUtilization,
    absenceNote: floorHealth.absenceNote ?? "No absences",
    coverageNote: floorHealth.coverageNote,
  };

  return (
    <EnterpriseDrawer
      open={open}
      onClose={onClose}
      title="Floor Capacity & Labor Schedule"
    >
      <div className="space-y-8 p-5 sm:p-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" aria-hidden />
            <span className="text-base font-semibold text-blue-800">
              Today&apos;s Floor Health
            </span>
          </div>
          <p className="text-base leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">
              {capacityUtilization}% Capacity Utilization
            </span>
            <span className="text-slate-400"> · </span>
            <span>{absenceNote}</span>
            <span className="text-slate-400"> · </span>
            <span className="font-medium text-emerald-700">{coverageNote}</span>
          </p>
        </div>

        <div className="space-y-3">
          <AiButton
            onClick={handleRebalance}
            loading={isRebalancing}
            disabled={isRebalancing}
          >
            AI Rebalance Floor
          </AiButton>
          {statusMessage && (
            <p
              className={`rounded-xl border px-4 py-3 text-base font-medium ${
                isRebalancing
                  ? "border-violet-200 bg-violet-50 text-violet-800"
                  : rebalanced
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600"
              }`}
              role="status"
              aria-live="polite"
            >
              {statusMessage}
            </p>
          )}
        </div>

        <section aria-label="Worker roster">
          <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
            Fabricator Roster
          </h3>
          <ul className="space-y-3">
            {floorWorkers.map((worker) => (
              <WorkerRow key={worker.id} worker={worker} />
            ))}
          </ul>
        </section>

        <section aria-label="Production schedule">
          <h3 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">
            Scheduling Whiteboard
          </h3>
          <p className="mb-4 text-base text-slate-600">
            Estimated completion timeline by job
          </p>
          <div
            className={`overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity duration-300 ${
              isRebalancing ? "opacity-60" : ""
            }`}
          >
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-base font-semibold text-slate-600">
                    Date
                  </th>
                  <th className="px-4 py-3 text-base font-semibold text-slate-600">
                    Job
                  </th>
                  <th className="px-4 py-3 text-base font-semibold text-slate-600">
                    Assigned
                  </th>
                </tr>
              </thead>
              <tbody>
                {isRebalancing
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 3 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 animate-pulse rounded bg-violet-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((row, index) => (
                      <tr
                        key={row.jobCode}
                        className={`border-b border-slate-100 ${
                          index % 2 === 0 ? "bg-white" : "bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-base text-slate-600">
                          {formatShortDate(row.estimatedDate)}
                        </td>
                        <td className="px-4 py-3 text-base font-semibold text-slate-900">
                          {row.jobCode}
                        </td>
                        <td className="px-4 py-3 text-base text-slate-700">
                          {row.assignedTo === "Unassigned" ? (
                            <span className="text-slate-500">Unassigned</span>
                          ) : (
                            row.assignedTo
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </EnterpriseDrawer>
  );
}
