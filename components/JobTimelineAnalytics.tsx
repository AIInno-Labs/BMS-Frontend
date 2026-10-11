"use client";

import { useMemo, useState } from "react";
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
import {
  buildJobTimelineAnalytics,
  type JobTimelineAnalyticsData,
  type StageDetailInsight,
  type TimelineStageId,
  type TimelineSubStageView,
} from "@/lib/jobTimelineAnalytics";
import type { Job } from "@/lib/types";

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
  | { type: "stage"; stageId: TimelineStageId }
  | { type: "health" };

function formatDueLine(job: Job): string {
  const raw = job.dueDate ?? job.date;
  if (!raw) return "Due date not set";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `Due ${raw}`;
  return `Due ${d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function jobStageLabel(status: Job["status"]): string {
  if (status === "Complete") return "Delivered";
  if (status === "In Fabrication") return "Manufacturing";
  return "Not Started";
}

function jobStageClass(status: Job["status"]): string {
  if (status === "Complete") return "status-pill status-pill--delivered";
  if (status === "In Fabrication") return "status-pill status-pill--manufacturing";
  return "status-pill status-pill--not-started";
}

interface JobTimelineAnalyticsProps {
  job: Job;
  drawingDoneCount?: number;
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

function MinorTimelineNode({ sub }: { sub: TimelineSubStageView }) {
  const isActive = sub.state === "active";
  const isComplete = sub.state === "complete";

  return (
    <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center">
      <div className="relative flex h-5 w-5 items-center justify-center" title={sub.title}>
        {isActive ? (
          <>
            <span
              className="absolute inset-0 rounded-full border-2 border-red-500"
              aria-hidden
            />
            <span className="relative flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
              <span className="h-1 w-1 rounded-full bg-white" aria-hidden />
            </span>
          </>
        ) : isComplete ? (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400 bg-slate-400" />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 bg-white" />
        )}
      </div>
      <p
        className={`mt-2 text-center text-[11px] leading-tight ${
          isActive ? "font-semibold text-slate-800" : "font-medium text-slate-600"
        }`}
      >
        {sub.shortLabel}
        {isActive && sub.durationLabel ? (
          <span className="font-normal text-slate-500"> ({sub.durationLabel})</span>
        ) : null}
      </p>
    </div>
  );
}

function SubStageTimeline({ subStages }: { subStages: TimelineSubStageView[] }) {
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
            <MinorTimelineNode key={sub.id} sub={sub} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageDetailContent({
  stage,
  detail,
}: {
  stage: JobTimelineAnalyticsData["stages"][number];
  detail: StageDetailInsight;
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
        <dd className="mt-0.5 text-slate-700">{detail.notes}</dd>
      </div>
    </dl>
    {stage.subStages && stage.subStages.length > 0 && (
      <div className="mt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Sub-stages
        </p>
        <SubStageTimeline subStages={stage.subStages} />
      </div>
    )}
    </>
  );
}

function renderDetailContent(
  key: DetailKey,
  data: JobTimelineAnalyticsData,
  progressDisplay: number
) {
  if (key.type === "stage") {
    const stage = data.stages.find((s) => s.id === key.stageId)!;
    return {
      title: `${stage.title} — stage details`,
      body: <StageDetailContent stage={stage} detail={data.stageDetails[key.stageId]} />,
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
}: JobTimelineAnalyticsProps) {
  const data = useMemo(
    () => buildJobTimelineAnalytics(job, drawingDoneCount),
    [job, drawingDoneCount]
  );
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
      if (!prev) return key;
      if (prev.type !== key.type) return key;
      if (key.type === "stage" && prev.type === "stage") {
        return prev.stageId === key.stageId ? null : key;
      }
      return null;
    });
  };

  const isStageSelected = (id: TimelineStageId) =>
    selected?.type === "stage" && selected.stageId === id;

  const detailContent = selected
    ? renderDetailContent(selected, data, progressDisplay)
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6"
      aria-label="Job timeline analytics"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm uppercase tracking-wide text-slate-400">{job.id}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-[#111827] sm:text-2xl">
            {job.projectName}
          </h2>
          <p className="text-sm text-slate-600">{job.clientName}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Calendar className="h-4 w-4 text-orange-500" aria-hidden />
            {formatDueLine(job)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={jobStageClass(job.status)}>{jobStageLabel(job.status)}</span>
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
              <SubStageTimeline subStages={focusedStage.subStages} />
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
