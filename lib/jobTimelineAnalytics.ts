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
  { id: "draft", title: "Pending", shortLabel: "Pending" },
  { id: "design", title: "Drawing", shortLabel: "Drawing" },
  { id: "approval", title: "Approval", shortLabel: "Approval" },
  { id: "production", title: "Production", shortLabel: "Production" },
  { id: "qc", title: "QC", shortLabel: "QC" },
  { id: "dispatch", title: "Dispatch", shortLabel: "Dispatch" },
  { id: "completed", title: "Completed", shortLabel: "Done" },
];

/**
 * `job.currentStageKey` → the real milestone name (e.g. "design" → "Drawing").
 * Backend-authoritative (`JobStageServiceImpl.recomputeJobStatus`): the
 * furthest milestone that's complete or active, so it stays accurate even
 * while the coarse `stageStatus`/group bucket hasn't advanced yet. `null` for
 * jobs the backend hasn't populated it on — callers should fall back to the
 * coarse status group in that case.
 */
export function timelineStageInfo(
  stageKey?: string | null
): { title: string; shortLabel: string } | null {
  return TIMELINE_STAGES.find((s) => s.id === stageKey) ?? null;
}

/**
 * The stages a job's "Project Stages" setup can turn on/off. "draft" and
 * "completed" are excluded — every job starts pending and ends completed,
 * that much is never optional.
 */
export const CONFIGURABLE_TIMELINE_STAGE_IDS: TimelineStageId[] = [
  "design",
  "approval",
  "production",
  "qc",
  "dispatch",
];

/**
 * The "Job Stage Setting" modal's own substage catalog. Drawing/Approval/
 * Production/QC mirror the real operations Status Control seeds per
 * milestone (`JobStageServiceImpl.OPERATIONS_BY_MILESTONE` on the backend),
 * so the names match what the team already sees there. Dispatch has no
 * operations there yet, so it gets a single stand-in entry named after
 * itself — just enough for the "at least one substage checked" rule to
 * apply to it too, without inventing real sub-steps that don't exist yet.
 *
 * A stage only appears on the main timeline if at least one of its own
 * substages here is selected — see `selectedTimelineStageIds`.
 */
export const SELECTABLE_SUBSTAGES: Record<
  TimelineStageId,
  Array<{ id: string; title: string }>
> = {
  draft: [],
  design: [
    { id: "scope", title: "General Arrangement" },
    { id: "cad", title: "Issued for comment" },
    { id: "rev", title: "Issued for Approval" },
    { id: "revision", title: "Revision loop" },
  ],
  approval: [
    // Ids must match the backend's real operation keys exactly (odd
    // formatting and all) — this is what lets a manual pick here actually
    // filter the real stage tree fetched from Status Control. See
    // JobStageServiceImpl.OPERATIONS_BY_MILESTONE.
    { id: "client Approv.", title: "Client Approval" },
    { id: "engineer Approv.", title: "Engineer Approval" },
  ],
  production: [
    { id: "mould", title: "Shop drawings" },
    { id: "layup", title: "Fabrication" },
    { id: "cure", title: "Prep for QC" },
  ],
  qc: [
    { id: "visual", title: "Visual Inspection" },
    { id: "photos", title: "Photos added" },
    { id: "dimensional", title: "Dimensional Check" },
    { id: "signoff", title: "QA Sign-off" },
  ],
  dispatch: [{ id: "dispatch", title: "Dispatch" }],
  completed: [],
};

/**
 * Whether the job has been set up — meaning the timeline can be trusted and
 * unlocked. Until then it shows (but locks) every stage rather than reacting to
 * a still-in-progress decision.
 *
 * Three things settle it, and any one is enough:
 *
 * - `requirementsConfirmedAt`, set by Mark Ready. This is the real gate: a job
 *   can be taken out of idle without any requirement applying to it, and that
 *   job's timeline must still work. Without this the stages stayed faded after
 *   marking ready — completed ones included, which plainly do apply.
 * - Project Requirements having been confirmed, or
 * - the Job Stage Setting modal having been used,
 *
 * the latter two covering jobs set up before Mark Ready existed, whose
 * timestamp is null but whose stages were chosen all the same.
 */
export function isStageSetupDone(job: Job): boolean {
  return (
    job.requirementsConfirmedAt != null ||
    job.printDetails?.workflowExtras?.stageSelectionSource != null
  );
}

/**
 * Which of the two stage-selection mechanisms is live right now.
 * `stageSelectionSource` is set the moment either one is used — a Project
 * Requirements checkbox saves it immediately (not gated behind "Save and
 * Resume"; that button exists only to switch back to Project Requirements
 * after the modal was used more recently, or to force-confirm without
 * touching a box), and the "Job Stage Setting" modal sets it on save. Once
 * set, this derives the visible stages live from whichever source it names,
 * reacting to every checkbox change immediately rather than waiting for a
 * separate confirm step.
 *
 * "Plan A" per the client's spec for the Project Requirements path —
 * deliberately simple and a little blunt, exactly as specified:
 *
 * - Supply only / Order from Supplier (either variant) hides Drawing,
 *   Approval, Production and QC outright — this takes priority over
 *   everything else below.
 * - Project means "the normal full flow" — Drawing and QC both show.
 * - Otherwise, Drawing only shows if "Drawings" is checked, QC only shows if
 *   "LOC" is checked (both off by default).
 * - Approval and Production have no individual toggle — they show unless the
 *   Supply-only/Order-from-Supplier bundle above hides them.
 * - Dispatch is never hidden by any of this.
 *
 * Falls back to "everything" until a source has ever been set.
 */
/**
 * The stage keys to send to `PUT /jobs/{id}/stages/selection` for a pick made
 * in the Job Stage Setting modal.
 *
 * A milestone is included only when at least one of its substages is checked -
 * the modal's own rule - and it travels together with exactly the substages
 * that were checked, because naming substages is exact server-side: a
 * milestone sent with two of its three operations switches the third off.
 *
 * `draft` and `completed` are always included. They are not configurable in
 * the modal, and anything absent from this list is switched off, so leaving
 * them out would quietly remove the stage every job starts at and the one it
 * ends at.
 */
export function stageKeysForManualSelection(
  selection: Record<string, string[]>
): string[] {
  const keys = new Set<string>(["draft", "completed"]);
  for (const stageId of CONFIGURABLE_TIMELINE_STAGE_IDS) {
    const subs = selection[stageId] ?? [];
    if (subs.length === 0) continue;
    keys.add(stageId);
    // Dispatch's only "substage" is a stand-in for the milestone itself - the
    // backend seeds it with no operations - so adding it is harmless and
    // adding the milestone is what matters.
    subs.forEach((sub) => keys.add(sub));
  }
  return [...keys];
}

/**
 * The same, for a Project Requirements confirmation. The requirements choose
 * whole milestones, so no substages are named and every operation beneath a
 * chosen milestone stays on.
 */
export function stageKeysForRequirements(job: Job): string[] {
  return ["draft", "completed", ...selectedTimelineStageIds(job)];
}

export function selectedTimelineStageIds(job: Job): TimelineStageId[] {
  const extras = job.printDetails?.workflowExtras;
  const source = extras?.stageSelectionSource;

  if (source === "manual") {
    const manualSub = extras?.manualSelectedSubStageIds;
    if (manualSub) {
      return CONFIGURABLE_TIMELINE_STAGE_IDS.filter(
        (id) => (manualSub[id]?.length ?? 0) > 0
      );
    }
  }

  if (source === "requirements") {
    const req = extras?.projectStageRequirements;
    if (req) {
      const supplyPathOnly =
        req.supplyOnly ||
        req.orderFromSupplierSupplyOnly ||
        req.orderFromSupplierFabrication;
      if (supplyPathOnly) return ["dispatch"];

      const ids: TimelineStageId[] = [];
      if (req.project || req.drawings) ids.push("design");
      ids.push("approval");
      ids.push("production");
      if (req.project || req.loc) ids.push("qc");
      ids.push("dispatch");
      return ids;
    }
  }

  return CONFIGURABLE_TIMELINE_STAGE_IDS;
}

export interface TimelineSubStageView {
  id: string;
  title: string;
  shortLabel: string;
  state: "complete" | "active" | "upcoming";
  completionPct: number;
  /** Active sub-stage only, e.g. `4 D` */
  durationLabel?: string;
  notes?: string;
  assignedTeam?: string;
  startDate?: string;
  endDate?: string;
  statusLabel?: string;
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
    { id: "rev", title: "Rev A issue", shortLabel: "Rev A" },
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
  let defs = SUB_STAGES_BY_PARENT[parentId];
  if (!defs?.length) return undefined;

  // A manual "Job Stage Setting" pick also narrows what shows in this
  // stage's own drill-down — picking only 1 of Drawing's 3 substages
  // should mean only that 1 appears here too, not all 3 regardless.
  const picked = job.printDetails?.workflowExtras?.manualSelectedSubStageIds?.[
    parentId
  ];
  if (picked) {
    const narrowed = defs.filter((def) => picked.includes(def.id));
    if (narrowed.length > 0) defs = narrowed;
  }

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
  /** The milestone's own note, before any child fallback. */
  ownNotes?: string;
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
      notes: "",
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
