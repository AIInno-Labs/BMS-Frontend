import type { Job } from "@/lib/types";

export const TIMELINE_STAGE_IDS = [
  "draft",
  "design",
  "approval",
  "production",
  "qc",
  "dispatch",
  "completed",
] as const;

export type TimelineStageId = (typeof TIMELINE_STAGE_IDS)[number];

export type TimelineFilter =
  | "all"
  | "critical"
  | "delayed"
  | "active"
  | "completed"
  | "qc_hold";

export const TIMELINE_FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "delayed", label: "Delayed" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "qc_hold", label: "QC Hold" },
];

export const TIMELINE_STAGES: Array<{
  id: TimelineStageId;
  title: string;
  shortLabel: string;
}> = [
  { id: "draft", title: "Draft", shortLabel: "Draft" },
  { id: "design", title: "Drawing", shortLabel: "Drawing" },
  { id: "approval", title: "Approval", shortLabel: "Approval" },
  { id: "production", title: "Production", shortLabel: "Production" },
  { id: "qc", title: "QC", shortLabel: "QC" },
  { id: "dispatch", title: "Dispatch", shortLabel: "Dispatch" },
  { id: "completed", title: "Completed", shortLabel: "Done" },
];

export interface TimelineSubStageView {
  id: string;
  title: string;
  shortLabel: string;
  state: "complete" | "active" | "upcoming";
  completionPct: number;
  /** Active sub-stage only, e.g. `4 D` */
  durationLabel?: string;
}

export interface TimelineStageView {
  id: TimelineStageId;
  title: string;
  dateLabel: string;
  durationLabel: string;
  completionPct: number;
  state: "complete" | "active" | "upcoming";
  isCritical?: boolean;
  isDelayed?: boolean;
  isQcHold?: boolean;
  subStages?: TimelineSubStageView[];
}

const SUB_STAGES_BY_PARENT: Partial<
  Record<TimelineStageId, Array<{ id: string; title: string; shortLabel: string }>>
> = {
  design: [
    { id: "scope", title: "Scoping", shortLabel: "Scope" },
    { id: "cad", title: "CAD layout", shortLabel: "CAD" },
    { id: "rev-a", title: "Rev A issue", shortLabel: "Rev A" },
  ],
  production: [
    { id: "mould", title: "Mould prep", shortLabel: "Mould" },
    { id: "layup", title: "Layup", shortLabel: "Layup" },
    { id: "cure", title: "Cure & trim", shortLabel: "Cure" },
  ],
  qc: [
    { id: "visual", title: "Visual inspect", shortLabel: "Visual" },
    { id: "dimensional", title: "Dimensional", shortLabel: "Dim" },
    { id: "signoff", title: "Sign-off", shortLabel: "Sign-off" },
  ],
};

function buildSubStages(
  parentId: TimelineStageId,
  parentState: TimelineStageView["state"],
  parentCompletionPct: number,
  drawingDoneCount: number,
  job: Job
): TimelineSubStageView[] | undefined {
  const defs = SUB_STAGES_BY_PARENT[parentId];
  if (!defs?.length) return undefined;

  let activeSubIndex = 0;
  if (parentState === "complete") {
    activeSubIndex = defs.length;
  } else if (parentState === "active") {
    if (parentId === "design") {
      activeSubIndex = Math.min(defs.length - 1, drawingDoneCount);
    } else if (parentId === "production") {
      activeSubIndex = job.status === "In Fabrication" ? 1 : 0;
    } else if (parentId === "qc") {
      activeSubIndex = job.qaCompleted ? 2 : 0;
    }
  }

  return defs.map((def, index) => {
    const state: TimelineSubStageView["state"] =
      parentState === "upcoming"
        ? "upcoming"
        : index < activeSubIndex
          ? "complete"
          : index === activeSubIndex && parentState === "active"
            ? "active"
            : parentState === "complete"
              ? "complete"
              : "upcoming";

    let completionPct = 0;
    if (state === "complete") completionPct = 100;
    else if (state === "active") {
      completionPct =
        parentId === "design"
          ? Math.min(95, 35 + drawingDoneCount * 20)
          : Math.min(95, Math.round(parentCompletionPct * 0.85));
    }

    return {
      id: def.id,
      title: def.title,
      shortLabel: def.shortLabel,
      state,
      completionPct,
      durationLabel:
        state === "active" ? `${Math.max(1, 2 + index)} D` : undefined,
    };
  });
}

export interface StageDetailInsight {
  startDate: string;
  endDate: string;
  assignedTeam: string;
  status: string;
  dependency: string;
  notes: string;
}

export interface SmartSummary {
  currentStage: string;
  daysRemaining: number;
  riskLevel: "Low" | "Medium" | "High";
  completionPct: number;
  owner: string;
}

export interface JobTimelineAnalyticsData {
  activeIndex: number;
  activeStageId: TimelineStageId;
  overallProgress: number;
  estimatedCompletionDays: number;
  delayedTasks: number;
  teamEfficiency: number;
  stages: TimelineStageView[];
  stageDetails: Record<TimelineStageId, StageDetailInsight>;
  smartSummary: SmartSummary;
  criticalAttentionItems: string[];
  efficiencyInsights: string[];
  sparklines: {
    progress: { v: number }[];
    eta: { v: number }[];
    delays: { v: number }[];
    efficiency: { v: number }[];
  };
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function formatStageDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const TEAM_BY_STAGE: Record<TimelineStageId, string> = {
  draft: "Commercial / Estimating",
  design: "Engineering & CAD",
  approval: "Project Management",
  production: "Fabrication Team",
  qc: "Quality Assurance",
  dispatch: "Logistics",
  completed: "Customer Success",
};

/** Maps fabrication job state → ERP-style 7-stage analytics timeline (mock-enriched). */
export function buildJobTimelineAnalytics(
  job: Job,
  drawingDoneCount = 0
): JobTimelineAnalyticsData {
  let activeIndex = 0;

  switch (job.status) {
    case "Complete":
      activeIndex = 6;
      break;
    case "In Fabrication":
      activeIndex = 3;
      break;
    case "Ready to Manufacture":
      activeIndex = 3;
      break;
    case "Awaiting Manager Approval":
      activeIndex = 2;
      break;
    case "On Hold":
      activeIndex = Math.max(1, Math.min(4, 2 + Math.floor(drawingDoneCount / 2)));
      break;
    case "Cancelled":
      activeIndex = 0;
      break;
    default:
      if (drawingDoneCount >= 3) activeIndex = 2;
      else if (drawingDoneCount >= 1) activeIndex = 1;
      else activeIndex = 0;
  }

  const raised = job.createdAt ? new Date(job.createdAt) : new Date(job.date);
  const due = job.dueDate ? new Date(job.dueDate) : new Date(raised.getTime() + 14 * 86400000);
  const totalDays = Math.max(7, daysBetween(raised, due));
  const elapsed = daysBetween(raised, new Date());
  const overallProgress = Math.min(100, Math.round(((activeIndex + 0.35) / 6) * 100));
  const daysRemaining = Math.max(0, daysBetween(new Date(), due));

  const stageOffsets = [0, 2, 5, 9, 12, 14, totalDays];
  const stageDetails = {} as Record<TimelineStageId, StageDetailInsight>;

  const stages: TimelineStageView[] = TIMELINE_STAGES.map((stage, index) => {
    const state: TimelineStageView["state"] =
      index < activeIndex ? "complete" : index === activeIndex ? "active" : "upcoming";

    const startDay = stageOffsets[index] ?? 0;
    const endDay = stageOffsets[index + 1] ?? totalDays;
    const span = Math.max(1, endDay - startDay);
    const startDate = new Date(raised.getTime() + startDay * 86400000);
    const endDate = new Date(raised.getTime() + endDay * 86400000);

    let completionPct = 0;
    if (state === "complete") completionPct = 100;
    else if (state === "active") {
      completionPct = Math.min(
        99,
        Math.round(40 + (drawingDoneCount / 5) * 30 + (elapsed / totalDays) * 25)
      );
      if (job.status === "In Fabrication" && index === 3) completionPct = 68;
    }

    const isQcHold = job.status === "On Hold" && stage.id === "qc";
    const isDelayed =
      state === "upcoming" && index === activeIndex + 1 && Boolean(job.alert);
    const isCritical =
      isDelayed ||
      (state === "active" && Boolean(job.alert)) ||
      (stage.id === "qc" && job.qaCompleted === false && index <= activeIndex);

    stageDetails[stage.id] = {
      startDate: formatStageDate(startDate),
      endDate: state === "upcoming" ? "TBD" : formatStageDate(endDate),
      assignedTeam: TEAM_BY_STAGE[stage.id],
      status:
        state === "complete"
          ? "Complete"
          : state === "active"
            ? "In progress"
            : isQcHold
              ? "On hold"
              : "Scheduled",
      dependency:
        index === 0
          ? "Quote acceptance"
          : index === 3
            ? "Drawing Rev A + material release"
            : index === 4
              ? "Production sign-off"
              : `Prior stage: ${TIMELINE_STAGES[index - 1]?.title ?? "—"}`,
      notes:
        state === "active"
          ? job.manualInstructions?.slice(0, 80) || "No blockers logged on shop floor."
          : state === "complete"
            ? "Gate cleared — logged in program history."
            : "Awaiting upstream completion.",
    };

    return {
      id: stage.id,
      title: stage.title,
      dateLabel: formatStageDate(startDate),
      durationLabel:
        state === "active"
          ? `${span}d in stage`
          : state === "complete"
            ? `${span}d`
            : "Scheduled",
      completionPct,
      state,
      isCritical,
      isDelayed,
      isQcHold,
      subStages: buildSubStages(stage.id, state, completionPct, drawingDoneCount, job),
    };
  });

  const alertPenalty = job.alert ? 2 : 0;
  const priorityPenalty = job.priority === "RUSH" ? 0 : job.priority === "High" ? 1 : 0;
  const delayedTasks = Math.min(
    9,
    alertPenalty + priorityPenalty + (job.status === "On Hold" ? 2 : 0) + 1
  );
  const teamEfficiency = Math.min(
    99,
    Math.max(72, 91 - alertPenalty * 4 - (job.status === "On Hold" ? 8 : 0))
  );

  const riskLevel: SmartSummary["riskLevel"] =
    job.alert || job.status === "On Hold"
      ? "High"
      : job.priority === "RUSH" || delayedTasks >= 3
        ? "Medium"
        : "Low";

  const criticalAttentionItems = [
    ...(job.qaCompleted === false && activeIndex >= 3
      ? ["QC report pending approval"]
      : []),
    ...(job.alert ? [job.alert] : ["Material dispatch delayed by 1 day"]),
    "Vendor confirmation missing for clip assembly",
  ].slice(0, 4);

  const efficiencyInsights = [
    "Cutting team operating at 96%",
    teamEfficiency < 85 ? "Welding team below target (82%)" : "Welding team on target (94%)",
    "Average throughput improved by 8% vs. last month",
    job.assignedWorkerName
      ? `Lead: ${job.assignedWorkerName} — capacity aligned`
      : "Assign workshop lead to improve load balancing",
  ];

  return {
    activeIndex,
    activeStageId: TIMELINE_STAGES[activeIndex].id,
    overallProgress,
    estimatedCompletionDays: daysRemaining || 12,
    delayedTasks,
    teamEfficiency,
    stages,
    stageDetails,
    smartSummary: {
      currentStage: TIMELINE_STAGES[activeIndex].title,
      daysRemaining: daysRemaining || 12,
      riskLevel,
      completionPct: overallProgress,
      owner: TEAM_BY_STAGE[TIMELINE_STAGES[activeIndex].id],
    },
    criticalAttentionItems,
    efficiencyInsights,
    sparklines: {
      progress: [42, 48, 51, 55, 58, 62, overallProgress].map((v) => ({ v })),
      eta: [18, 16, 15, 14, 13, 12, daysRemaining || 12].map((v) => ({ v })),
      delays: [5, 4, 4, 3, 3, 3, delayedTasks].map((v) => ({ v })),
      efficiency: [84, 86, 87, 88, 89, 90, teamEfficiency].map((v) => ({ v })),
    },
  };
}

/** Whether a stage should be emphasized under the current filter. */
export function stageMatchesFilter(
  stage: TimelineStageView,
  filter: TimelineFilter,
  activeIndex: number,
  stageIndex: number
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return stage.state === "active";
  if (filter === "completed") return stage.state === "complete";
  if (filter === "delayed") {
    return Boolean(stage.isDelayed) || (stage.state === "upcoming" && stageIndex > activeIndex);
  }
  if (filter === "critical") return Boolean(stage.isCritical) || stage.state === "active";
  if (filter === "qc_hold") return stage.isQcHold || stage.id === "qc";
  return true;
}
