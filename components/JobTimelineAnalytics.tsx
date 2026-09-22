"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileEdit,
  Layers,
  PackageCheck,
  PenTool,
  Truck,
  X,
} from "lucide-react";
import { useAnimatedNumber } from "@/components/analytics/useAnimatedNumber";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobsContext";
import {
  buildJobTimelineAnalytics,
  timelineStageInfo,
  type JobTimelineAnalyticsData,
  type StageDetailInsight,
  type TimelineStageId,
  type TimelineStageView,
  type TimelineSubStageView,
} from "@/lib/jobTimelineAnalytics";
import { holdJob, listJobStages, resumeJob } from "@/lib/frp/api";
import type { FrpJobStageDTO } from "@/lib/frp/job-mapper";
import {
  isCancelledJob,
  isOnHoldJob,
  needsDraftDueDateWarning,
  DRAFT_DUE_DATE_WARNING,
} from "@/lib/frp/job-status";
import { isJobLockedForCashPayment } from "@/lib/frp/job-cash-payment-gate";
import { resolveStatusGroup } from "@/lib/jobStatus";
import type { JobStageGroup } from "@/lib/jobStageGroups";
import type { Job } from "@/lib/types";
import { resolveWorkerNameFromId } from "@/lib/workers";

const STAGE_ICONS: Record<
  TimelineStageId,
  React.ComponentType<{ className?: string }>
> = {
  draft: FileEdit,
  design: PenTool,
  approval: ClipboardCheck,
  production: Layers,
  qc: Activity,
  dispatch: Truck,
  completed: PackageCheck,
};

type DetailKey =
  | { type: "stage"; stageId: TimelineStageId; subStageId?: string }
  | { type: "health" };

/**
 * Empty string when there is no due date — the caller drops the whole line,
 * icon included, rather than labelling something else as a deadline.
 *
 * No fallback to `job.date`: that is when the job was raised, not when it is
 * due, and printing it after the word "Due" made up a deadline the job does
 * not have.
 */
function formatDueLine(job: Job): string {
  const raw = job.dueDate;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `Due ${raw}`;
  return `Due ${d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

const STAGE_GROUP_LABEL: Record<JobStageGroup, string> = {
  "not-started": "Not Started",
  manufacturing: "Manufacturing",
  delivered: "Delivered",
};

const STAGE_GROUP_CLASS: Record<JobStageGroup, string> = {
  "not-started": "status-pill status-pill--not-started",
  manufacturing: "status-pill status-pill--manufacturing",
  delivered: "status-pill status-pill--delivered",
};

// `currentStageKey` (backend-computed: furthest milestone that's complete or
// active) names the real stage the job is sitting at, e.g. "Drawing" — more
// precise than the coarse status group, which only flips once the *next*
// stage has started. Falls back to the group label for jobs the backend
// hasn't populated it on.
function jobStageLabel(job: Job): string {
  return (
    timelineStageInfo(job.currentStageKey)?.title ??
    STAGE_GROUP_LABEL[resolveStatusGroup(job.status)]
  );
}

function jobStageClass(status: Job["status"]): string {
  return STAGE_GROUP_CLASS[resolveStatusGroup(status)];
}

interface JobTimelineAnalyticsProps {
  job: Job;
  drawingDoneCount?: number;
  /** Refetch parent job after Assign to me (PUT /jobs). */
  onJobChanged?: () => void | Promise<void>;
}

/**
 * Real per-operation rows (Scope, CAD, Mould, Layup, ...) from the same stage
 * tree Status Control reads and edits (`GET /jobs/{id}/stages`), keyed under
 * their milestone as `children`. Replaces the old drawingDoneCount guesswork,
 * which never received a real count and always rendered every sub-stage as
 * "not started".
 *
 * The checklist only ever writes PENDING / SKIPPED / COMPLETE to an
 * operation — nothing sets IN_PROGRESS. So "current" isn't a stored status;
 * it's inferred the same way Status Control centers itself: the first
 * operation under the active milestone that isn't finished yet.
 */
function subStagesFromReal(
  children: FrpJobStageDTO[] | undefined,
  milestoneState: TimelineStageView["state"]
): TimelineSubStageView[] | undefined {
  if (!children?.length) return undefined;
  const sorted = [...children].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const isFinished = (op: FrpJobStageDTO) =>
    op.status === "COMPLETE" || op.status === "SKIPPED";

  const explicitActiveIndex = sorted.findIndex(
    (op) => op.status === "IN_PROGRESS" || op.status === "BLOCKED"
  );
  const firstUnfinishedIndex = sorted.findIndex((op) => !isFinished(op));
  const activeIndex =
    milestoneState === "active"
      ? explicitActiveIndex >= 0
        ? explicitActiveIndex
        : firstUnfinishedIndex
      : -1;

  return sorted.map((op, index) => {
    const state: TimelineSubStageView["state"] =
      milestoneState === "complete" || isFinished(op)
        ? "complete"
        : index === activeIndex
          ? "active"
          : "upcoming";
    const durationLabel =
      state === "active" && op.startedAt
        ? `${Math.max(
            1,
            Math.round(
              (Date.now() - new Date(op.startedAt).getTime()) / 86400000
            )
          )} D`
        : undefined;
    return {
      id: op.stageKey ?? String(op.id ?? ""),
      title: op.stageName ?? op.stageKey ?? "",
      shortLabel: op.stageName ?? op.stageKey ?? "",
      state,
      completionPct: op.percentComplete ?? (state === "complete" ? 100 : 0),
      durationLabel,
      notes: op.notes?.trim() || "",
      assignedTeam:
        op.assignees
          ?.map((u) => u.displayName?.trim() || u.username?.trim() || (u.id != null ? String(u.id) : ""))
          .filter(Boolean)
          .join(", ") ||
        op.assignedTeam?.trim() ||
        "",
      startDate: formatStageInstant(op.startedAt),
      endDate: formatStageInstant(op.completedAt),
      statusLabel: statusLabelOf(op.status),
    };
  });
}

function formatStageInstant(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabelOf(status?: FrpJobStageDTO["status"]): string {
  switch (status) {
    case "COMPLETE":
      return "Complete";
    case "IN_PROGRESS":
      return "In progress";
    case "BLOCKED":
      return "Blocked";
    case "SKIPPED":
      return "Skipped";
    default:
      return "Pending";
  }
}

/** Selected stage's notes: current substage, else any child, else the parent. */
function notesFromRealStage(milestone: FrpJobStageDTO): string {
  const parent = milestone.notes?.trim() || "";
  const children = [...(milestone.children ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const pick = (op: FrpJobStageDTO | undefined) => op?.notes?.trim() || "";
  const isFinished = (op: FrpJobStageDTO) =>
    op.status === "COMPLETE" || op.status === "SKIPPED";
  const active =
    children.find((op) => op.status === "IN_PROGRESS" || op.status === "BLOCKED") ??
    children.find((op) => !isFinished(op));
  if (pick(active)) return pick(active);
  for (let i = children.length - 1; i >= 0; i--) {
    if (pick(children[i])) return pick(children[i]);
  }
  return parent;
}

function DetailPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="rounded-xl border border-orange-200 bg-orange-50/40 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#E5E7EB] bg-white p-1 text-slate-500 hover:border-orange-200 hover:text-orange-700"
            aria-label="Close details"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </motion.div>
  );
}

function MinorTimelineNode({
  sub,
  selected,
  onSelect,
}: {
  sub: TimelineSubStageView;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const isActive = sub.state === "active";
  const isComplete = sub.state === "complete";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative z-10 flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-md px-1 py-1 transition-colors hover:bg-white/70 ${
        selected ? "bg-white ring-1 ring-orange-300" : ""
      }`}
      aria-pressed={selected}
      aria-label={`${sub.title} — view details`}
    >
      <div className="relative flex h-5 w-5 items-center justify-center" title={sub.title}>
        {isActive ? (
          <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-red-400 ring-offset-2 ring-offset-white">
            <span className="h-1 w-1 rounded-full bg-white" aria-hidden />
          </span>
        ) : isComplete ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-red-500 bg-red-500" />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 bg-white" />
        )}
      </div>
      <p
        className={`mt-2 text-center text-[11px] leading-tight ${
          selected || isActive ? "font-semibold text-slate-800" : "font-medium text-slate-600"
        }`}
      >
        {sub.shortLabel}
        {isActive && sub.durationLabel ? (
          <span className="font-normal text-slate-500"> ({sub.durationLabel})</span>
        ) : null}
      </p>
    </button>
  );
}

function SubStageTimeline({
  subStages,
  selectedSubId,
  onSelectSub,
}: {
  subStages: TimelineSubStageView[];
  selectedSubId?: string;
  onSelectSub?: (subId: string) => void;
}) {
  const activeIndex = subStages.findIndex((sub) => sub.state === "active");
  const lineFillPct =
    activeIndex >= 0
      ? (activeIndex / Math.max(1, subStages.length - 1)) * 100
      : subStages.every((s) => s.state === "complete")
        ? 100
        : 0;

  return (
    <div
      className="rounded-lg bg-[#E8ECF0]/90 px-5 py-3.5"
      aria-label="Minor stage timeline"
    >
      <div className="relative">
        <div
          className="absolute left-4 right-4 top-[0.62rem] h-px bg-slate-400/80"
          aria-hidden
        />
        <div
          className="absolute left-4 top-[0.62rem] h-px bg-slate-600"
          style={{ width: `calc((100% - 2rem) * ${lineFillPct / 100})` }}
          aria-hidden
        />
        <div className="relative flex justify-between gap-2">
          {subStages.map((sub) => (
            <MinorTimelineNode
              key={sub.id}
              sub={sub}
              selected={selectedSubId === sub.id}
              onSelect={onSelectSub ? () => onSelectSub(sub.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageDetailContent({
  stage,
  detail,
  selectedSubId,
  onSelectSub,
}: {
  stage: JobTimelineAnalyticsData["stages"][number];
  detail: StageDetailInsight;
  selectedSubId?: string;
  onSelectSub?: (subId: string) => void;
}) {
  return (
    <>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-[10px] font-semibold uppercase text-slate-500">Status</dt>
        <dd className="font-medium text-orange-700">{detail.status}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase text-slate-500">Completion</dt>
        <dd className="font-mono font-medium text-[#111827]">{stage.completionPct}%</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase text-slate-500">Start</dt>
        <dd className="text-slate-700">{detail.startDate}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase text-slate-500">End</dt>
        <dd className="text-slate-700">{detail.endDate}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase text-slate-500">Assigned team</dt>
        <dd className="text-slate-700">{detail.assignedTeam}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase text-slate-500">Dependency</dt>
        <dd className="text-slate-700">{detail.dependency}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-[10px] font-semibold uppercase text-slate-500">Notes</dt>
        <dd className="mt-0.5 whitespace-pre-wrap text-slate-700">
          {detail.notes?.trim() ? (
            detail.notes
          ) : (
            <span className="text-slate-400">No notes.</span>
          )}
        </dd>
      </div>
    </dl>
    {stage.subStages && stage.subStages.length > 0 && (
      <div className="mt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Sub-stages
        </p>
        <SubStageTimeline
          subStages={stage.subStages}
          selectedSubId={selectedSubId}
          onSelectSub={onSelectSub}
        />
      </div>
    )}
    </>
  );
}

function renderDetailContent(
  key: DetailKey,
  data: JobTimelineAnalyticsData,
  progressDisplay: number,
  onSelectSub?: (stageId: TimelineStageId, subId: string) => void
) {
  if (key.type === "stage") {
    const stage = data.stages.find((s) => s.id === key.stageId)!;
    const sub = key.subStageId
      ? stage.subStages?.find((s) => s.id === key.subStageId)
      : undefined;
    const parentDetail = data.stageDetails[key.stageId];
    const detail: StageDetailInsight = sub
      ? {
          ...parentDetail,
          status: sub.statusLabel || parentDetail.status,
          startDate: sub.startDate || "—",
          endDate: sub.endDate || "—",
          assignedTeam: sub.assignedTeam || parentDetail.assignedTeam,
          notes: sub.notes?.trim() || parentDetail.ownNotes || "",
        }
      : parentDetail;
    return {
      title: sub
        ? `${stage.title} / ${sub.title} — stage details`
        : `${stage.title} — stage details`,
      body: (
        <StageDetailContent
          stage={{ ...stage, completionPct: sub?.completionPct ?? stage.completionPct }}
          detail={detail}
          selectedSubId={key.subStageId}
          onSelectSub={
            onSelectSub ? (subId) => onSelectSub(key.stageId, subId) : undefined
          }
        />
      ),
    };
  }
  if (key.type === "health") {
    const s = data.smartSummary;
    return {
      title: "Job Progress",
      body: (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Current stage</dt>
            <dd className="font-semibold">{s.currentStage}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Completion</dt>
            <dd className="font-mono font-semibold text-orange-600">{progressDisplay}%</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Days remaining</dt>
            <dd className="font-mono">{s.daysRemaining}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-slate-500">Risk</dt>
            <dd className="font-semibold">{s.riskLevel}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] uppercase text-slate-500">Owner</dt>
            <dd>{s.owner}</dd>
          </div>
        </dl>
      ),
    };
  }
  return null;
}

export function JobTimelineAnalytics({
  job,
  drawingDoneCount = 0,
  onJobChanged,
}: JobTimelineAnalyticsProps) {
  const { user } = useAuth();
  const { updateJob } = useJobs();
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [holdBusy, setHoldBusy] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const editsBlocked =
    isCancelledJob(job.status) || isJobLockedForCashPayment(job);
  const onHold = isOnHoldJob(job.status);
  // Same definition as computeJobAnalytics' overdue count: a due date in the
  // past on a job that isn't already finished/abandoned.
  const isOverdue =
    !!job.dueDate &&
    job.dueDate < new Date().toISOString().slice(0, 10) &&
    !isCancelledJob(job.status) &&
    job.status !== "Complete";
  const assignedToMe =
    user?.id != null &&
    job.assignedWorkerId != null &&
    job.assignedWorkerId === String(user.id);

  const assignJobToMe = async () => {
    if (editsBlocked || assignBusy || user?.id == null || job.dbId == null) return;
    const myId = String(user.id);
    if (job.assignedWorkerId === myId) return;
    setAssignBusy(true);
    setAssignError(null);
    try {
      await updateJob({
        ...job,
        assignedWorkerId: myId,
        assignedWorkerName: resolveWorkerNameFromId(myId),
      });
      await onJobChanged?.();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Could not assign job");
    } finally {
      setAssignBusy(false);
    }
  };

  const toggleHold = async () => {
    if (holdBusy || job.dbId == null) return;
    setHoldBusy(true);
    setHoldError(null);
    try {
      if (onHold) {
        await resumeJob(job.dbId);
      } else {
        await holdJob(job.dbId);
      }
      await onJobChanged?.();
    } catch (e) {
      setHoldError(e instanceof Error ? e.message : "Could not update hold status");
    } finally {
      setHoldBusy(false);
    }
  };

  // The mock, still used for the parts that have no server backing (dates,
  // insights, risk/efficiency). Progress and per-stage completion are replaced
  // below with the real stage tree.
  const baseData = useMemo(
    () => buildJobTimelineAnalytics(job, drawingDoneCount),
    [job, drawingDoneCount]
  );

  // The real stage tree — same source as Status Control. Refetched whenever the
  // job object changes (onJobChanged bumps it after a stage edit), so the
  // timeline moves with the actual work instead of a date-based estimate.
  const [realStages, setRealStages] = useState<FrpJobStageDTO[] | null>(null);
  useEffect(() => {
    if (!job.dbId) {
      setRealStages(null);
      return;
    }
    let cancelled = false;
    listJobStages(job.dbId)
      .then((tree) => {
        if (!cancelled) setRealStages(tree);
      })
      .catch(() => {
        if (!cancelled) setRealStages(null);
      });
    return () => {
      cancelled = true;
    };
  }, [job.dbId, job]);

  // Milestone keys line up 1:1 with the timeline stage ids, so overlay the real
  // percentage/state onto each stage and recompute the headline progress as the
  // average of the six real milestones (draft..dispatch), matching the backend.
  const data = useMemo<JobTimelineAnalyticsData>(() => {
    if (!realStages || realStages.length === 0) return baseData;
    const byKey = new Map<string, FrpJobStageDTO>();
    for (const m of realStages) {
      if (m.stageKey) byKey.set(m.stageKey, m);
    }

    const stages = baseData.stages.map((s) => {
      const real = byKey.get(s.id);
      if (!real) return s;
      const pct = real.percentComplete ?? 0;
      const state: TimelineStageView["state"] =
        real.status === "COMPLETE"
          ? "complete"
          : real.status === "IN_PROGRESS" || pct > 0
            ? "active"
            : "upcoming";
      return { ...s, completionPct: pct, state };
    });

    // The backend only flips the next milestone's status to IN_PROGRESS via a
    // specific save path (JobStageServiceImpl.openNextMilestone) - it doesn't
    // always run, so a job can sit with its next stage still PENDING/0% right
    // after the prior one completes. The tracker should show "where the job
    // is now" regardless, so promote the first non-complete stage in sequence
    // to active on the client, independent of the backend's own status field.
    const firstIncompleteIndex = stages.findIndex((s) => s.state !== "complete");
    if (firstIncompleteIndex !== -1 && stages[firstIncompleteIndex].state === "upcoming") {
      stages[firstIncompleteIndex] = { ...stages[firstIncompleteIndex], state: "active" };
    }

    for (let i = 0; i < stages.length; i++) {
      const real = byKey.get(stages[i].id);
      if (!real) continue;
      stages[i] = {
        ...stages[i],
        subStages: subStagesFromReal(real.children, stages[i].state) ?? stages[i].subStages,
      };
    }

    const ROLLUP: TimelineStageId[] = [
      "draft",
      "design",
      "approval",
      "production",
      "qc",
      "dispatch",
    ];
    const vals = ROLLUP.map((k) => byKey.get(k)?.percentComplete ?? 0);
    const overallProgress = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

    // Furthest stage that is complete or active — drives the connector fill.
    let activeIndex = 0;
    stages.forEach((s, i) => {
      if (s.state === "complete" || s.state === "active") activeIndex = i;
    });

    const stageDetails = { ...baseData.stageDetails };
    for (const s of stages) {
      const real = byKey.get(s.id);
      if (!real) continue;
      const start = formatStageInstant(real.startedAt);
      const end =
        real.status === "COMPLETE" || real.status === "SKIPPED"
          ? formatStageInstant(real.completedAt)
          : real.completedAt
            ? formatStageInstant(real.completedAt)
            : real.status === "PENDING"
              ? "—"
              : "TBD";
      stageDetails[s.id] = {
        ...stageDetails[s.id],
        startDate: start,
        endDate: end,
        status: statusLabelOf(real.status),
        notes: notesFromRealStage(real),
        ownNotes: real.notes?.trim() || "",
        assignedTeam:
          real.assignees
            ?.map((u) => u.displayName?.trim() || u.username?.trim() || (u.id != null ? String(u.id) : ""))
            .filter(Boolean)
            .join(", ") ||
          real.assignedTeam?.trim() ||
          stageDetails[s.id].assignedTeam,
      };
      // Node date under the milestone icon — use real start when present.
      if (real.startedAt) {
        const idx = stages.findIndex((x) => x.id === s.id);
        if (idx >= 0) {
          stages[idx] = {
            ...stages[idx],
            dateLabel: formatStageInstant(real.startedAt),
          };
        }
      }
    }

    return { ...baseData, stages, stageDetails, overallProgress, activeIndex };
  }, [baseData, realStages]);

  const [selected, setSelected] = useState<DetailKey | null>(null);

  const progressDisplay = useAnimatedNumber(data.overallProgress, 700);

  const lineFillPct = (data.activeIndex / 6) * 100;

  const focusedStage = useMemo(() => {
    if (selected?.type === "stage") {
      return data.stages.find((s) => s.id === selected.stageId);
    }
    return data.stages.find((s) => s.state === "active" && s.subStages?.length);
  }, [data.stages, selected]);

  const focusedStageIndex = focusedStage
    ? data.stages.findIndex((s) => s.id === focusedStage.id)
    : -1;

  const toggle = (key: DetailKey) => {
    setSelected((prev) => {
      if (key.type === "health") {
        return prev?.type === "health" ? null : key;
      }
      if (prev?.type !== "stage") return key;
      if (prev.stageId !== key.stageId) return key;
      if (key.subStageId) {
        return prev.subStageId === key.subStageId
          ? { type: "stage", stageId: key.stageId }
          : key;
      }
      return prev.subStageId ? { type: "stage", stageId: key.stageId } : null;
    });
  };

  const isStageSelected = (id: TimelineStageId) =>
    selected?.type === "stage" && selected.stageId === id;

  const detailContent = selected
    ? renderDetailContent(selected, data, progressDisplay, (stageId, subId) =>
        toggle({ type: "stage", stageId, subStageId: subId })
      )
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6"
      aria-label="Job timeline analytics"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm uppercase tracking-wide text-slate-400">{job.id}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-[#111827] sm:text-2xl">
            {job.projectName}
          </h2>
          <p className="text-sm text-slate-600">{job.clientName}</p>
          {/* The warning sits where the date would be, not in the page header:
              a missing due date is a fact about this field, and it reads as
              one only next to the field it is missing from. Cancelled jobs get
              neither - needsDraftDueDateWarning excludes them, since a
              cancelled job has no deadline left to miss. */}
          {formatDueLine(job) ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Calendar className="h-4 w-4 text-orange-500" aria-hidden />
              {formatDueLine(job)}
            </p>
          ) : needsDraftDueDateWarning(job) ? (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
              <Calendar className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              {DRAFT_DUE_DATE_WARNING}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex shrink-0 items-center gap-2">
            {!editsBlocked && user?.id != null && !assignedToMe ? (
              <button
                type="button"
                onClick={() => void assignJobToMe()}
                disabled={assignBusy}
                className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900 transition-colors hover:border-sky-300 hover:bg-sky-100 disabled:opacity-60"
              >
                {assignBusy ? "Assigning…" : "Assign to me"}
              </button>
            ) : null}
            {assignedToMe ? (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                Assigned to you
              </span>
            ) : null}
            {(isOverdue || onHold) && !isCancelledJob(job.status) ? (
              <button
                type="button"
                onClick={() => void toggleHold()}
                disabled={holdBusy}
                title={
                  onHold
                    ? "Resume — the backend blocks edits on this job until it's resumed"
                    : "Put this overdue job on hold — blocks edits until resumed"
                }
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                  onHold
                    ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"
                    : "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100"
                }`}
              >
                {holdBusy ? "Working…" : onHold ? "On hold — Resume" : "Put on hold"}
              </button>
            ) : null}
            <span className={jobStageClass(job.status)}>{jobStageLabel(job)}</span>
            <button
              type="button"
              onClick={() => toggle({ type: "health" })}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center transition-colors ${
                selected?.type === "health"
                  ? "border-orange-300 bg-orange-50 ring-2 ring-orange-200/50"
                  : "border-[#E5E7EB] bg-[#FAFBFC] hover:border-orange-200 hover:bg-orange-50/50"
              }`}
              aria-expanded={selected?.type === "health"}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Job Progress
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold leading-none text-orange-600">
                {progressDisplay}%
              </p>
            </button>
          </div>
          {assignError ? (
            <p className="max-w-xs text-right text-xs text-red-600">{assignError}</p>
          ) : null}
          {holdError ? (
            <p className="max-w-xs text-right text-xs text-red-600">{holdError}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="relative mx-auto min-w-[700px] max-w-4xl px-4">
          <div className="absolute left-6 right-6 top-[1.35rem] h-px bg-[#E5E7EB]" />
          <motion.div
            className="absolute left-6 top-[1.35rem] h-px bg-orange-400"
            initial={{ width: 0 }}
            animate={{ width: `calc((100% - 3rem) * ${lineFillPct / 100})` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />

          <div className="relative flex justify-between">
            {data.stages.map((stage, index) => {
              const Icon = STAGE_ICONS[stage.id];
              const isActive = stage.state === "active";
              const isComplete = stage.state === "complete";
              const isUpcoming = stage.state === "upcoming";
              const stageSelected = isStageSelected(stage.id);

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => toggle({ type: "stage", stageId: stage.id })}
                  className={`flex w-[13.5%] min-w-[76px] cursor-pointer flex-col items-center rounded-lg py-1 transition-colors hover:bg-orange-50/40 ${
                    stageSelected ? "bg-orange-50/70 ring-1 ring-orange-200" : ""
                  }`}
                  aria-pressed={stageSelected}
                  aria-label={`${stage.title}, ${stage.completionPct}% — view details`}
                >
                  <div className="relative flex h-[52px] w-[52px] items-center justify-center pointer-events-none">
                    {isActive && (
                      <>
                        <span
                          className="absolute inset-0 rounded-full bg-orange-400/15 blur-[2px]"
                          aria-hidden
                        />
                        <motion.span
                          className="absolute inset-0 rounded-full border border-orange-300/60"
                          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.35, 0.7] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                          aria-hidden
                        />
                        <span
                          className="absolute inset-[5px] rounded-full border border-orange-200/80"
                          aria-hidden
                        />
                      </>
                    )}

                    {isUpcoming ? (
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#D1D5DB] bg-white">
                        <span className="absolute inset-[7px] rounded-full border border-[#E5E7EB]" />
                      </div>
                    ) : (
                      <div
                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${
                          isComplete
                            ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_0_14px_rgba(249,115,22,0.35)]"
                            : "bg-gradient-to-br from-orange-500 to-orange-600 text-white jta-node-breathe"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-[18px] w-[18px]" />
                        ) : (
                          <Icon className="h-[18px] w-[18px]" />
                        )}
                      </div>
                    )}
                  </div>

                  <p
                    className={`mt-2.5 text-center text-[11px] font-semibold ${
                      isActive ? "text-orange-700" : isComplete ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {stage.title}
                  </p>
                  <p className="mt-0.5 text-center text-[10px] text-slate-500">
                    {stage.dateLabel}
                  </p>
                  <p className="text-center text-[10px] text-slate-400">
                    {stage.durationLabel}
                  </p>

                  <div className="mt-2 h-[3px] w-full max-w-[54px] overflow-hidden rounded-full bg-[#F1F5F9] pointer-events-none">
                    <div
                      className={`h-full rounded-full ${
                        isComplete || isActive ? "bg-orange-500" : "bg-transparent"
                      }`}
                      style={{ width: `${stage.completionPct}%` }}
                    />
                  </div>
                  <p
                    className={`mt-0.5 text-center font-mono text-[10px] ${
                      isActive ? "text-orange-600" : "text-slate-400"
                    }`}
                  >
                    {stage.completionPct}%
                  </p>
                </button>
              );
            })}
          </div>

          {focusedStage?.subStages && focusedStage.subStages.length > 0 && (
            <div className="relative mt-3">
              {focusedStageIndex >= 0 && (
                <div
                  className="pointer-events-none absolute -top-3"
                  style={{
                    left: `calc(1.5rem + ${focusedStageIndex} * (100% - 3rem) / 6)`,
                    transform: "translateX(-50%)",
                  }}
                  aria-hidden
                >
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              )}
              <SubStageTimeline
                subStages={focusedStage.subStages}
                selectedSubId={
                  selected?.type === "stage" && selected.stageId === focusedStage.id
                    ? selected.subStageId
                    : undefined
                }
                onSelectSub={(subId) =>
                  toggle({ type: "stage", stageId: focusedStage.id, subStageId: subId })
                }
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {detailContent && (
          <div className="mt-4">
            <DetailPanel title={detailContent.title} onClose={() => setSelected(null)}>
              {detailContent.body}
            </DetailPanel>
          </div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
