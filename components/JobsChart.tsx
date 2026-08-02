"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Layers } from "lucide-react";
import { STATUS_THEME } from "@/lib/statusColors";
import type { Job, JobStatus } from "@/lib/types";

const PIPELINE: {
  status: JobStatus;
  shortLabel: string;
  hint: string;
  fill: string;
  gradientId: string;
  gradientFrom: string;
  gradientTo: string;
}[] = [
  {
    status: "Pending",
    shortLabel: "Pending intake",
    hint: "New or quoted — not yet approved",
    fill: STATUS_THEME.notStarted.strong,
    gradientId: "barPending",
    gradientFrom: STATUS_THEME.notStarted.soft,
    gradientTo: STATUS_THEME.notStarted.strong,
  },
  {
    status: "Awaiting Manager Approval",
    shortLabel: "Awaiting approval",
    hint: "Needs manager sign-off",
    fill: STATUS_THEME.notStarted.strong,
    gradientId: "barAwaiting",
    gradientFrom: STATUS_THEME.notStarted.soft,
    gradientTo: STATUS_THEME.notStarted.strong,
  },
  {
    status: "Ready to Manufacture",
    shortLabel: "Ready to build",
    hint: "Cleared for the floor",
    fill: STATUS_THEME.manufacturing.strong,
    gradientId: "barReady",
    gradientFrom: STATUS_THEME.manufacturing.soft,
    gradientTo: STATUS_THEME.manufacturing.strong,
  },
  {
    status: "In Fabrication",
    shortLabel: "On the bay",
    hint: "Actively in production",
    fill: STATUS_THEME.manufacturing.strong,
    gradientId: "barFabrication",
    gradientFrom: STATUS_THEME.manufacturing.soft,
    gradientTo: STATUS_THEME.manufacturing.strong,
  },
];

type ChartRow = {
  status: JobStatus;
  shortLabel: string;
  hint: string;
  count: number;
  pct: number;
  fill: string;
  gradientId: string;
};

function buildChartData(jobs: Job[]): ChartRow[] {
  const total = jobs.length;
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    counts[job.status] = (counts[job.status] ?? 0) + 1;
  }
  return PIPELINE.map((stage) => {
    const count = counts[stage.status] ?? 0;
    return {
      status: stage.status,
      shortLabel: stage.shortLabel,
      hint: stage.hint,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      fill: stage.fill,
      gradientId: stage.gradientId,
    };
  });
}

function PipelineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">{row.status}</p>
      <p className="mt-0.5 text-sm text-slate-600">{row.hint}</p>
      <p className="mt-2 text-base font-bold text-slate-900">
        {row.count} job{row.count !== 1 ? "s" : ""}{" "}
        <span className="font-medium text-slate-500">({row.pct}% of queue)</span>
      </p>
    </div>
  );
}

export function JobsChart({ jobs }: { jobs: Job[] }) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const data = useMemo(() => buildChartData(jobs), [jobs]);
  const total = jobs.length;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const yMax = Math.max(maxCount + 1, 4);
  const rushCount = jobs.filter((j) => j.priority === "RUSH").length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Layers className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                Fabrication Pipeline
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Jobs by production stage - left to right is your floor workflow
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900">
              {total} active
            </span>
            {rushCount > 0 && (
              <span className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700">
                {rushCount} RUSH
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500 sm:text-sm">
          <span className="rounded-md bg-red-50 px-2 py-0.5 text-red-700">Sign-off</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">Floor ready</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">Delivered</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 border-b border-slate-100 px-4 py-2.5 min-[420px]:grid-cols-3 sm:px-5">
        {data.map((row, index) => (
          <button
            key={row.status}
            type="button"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(undefined)}
            className={`rounded-lg border px-2 py-2 text-left transition-all ${
              activeIndex === index
                ? "border-amber-300 bg-amber-50/80 shadow-sm"
                : "border-slate-200 bg-slate-50/80 hover:border-slate-300"
            }`}
          >
            <span
              className="mb-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: row.fill }}
              aria-hidden
            />
            <p className="text-lg font-bold leading-none text-slate-900">
              {row.count}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-700 sm:text-sm">
              {row.shortLabel}
            </p>
            <p className="text-xs text-slate-500">{row.pct}%</p>
          </button>
        ))}
      </div>

      <div className="px-3 pb-3 pt-2 sm:px-4">
        <p className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          Job count by stage
        </p>
        <div className="h-[clamp(140px,24vh,220px)] w-full min-w-0 sm:h-[clamp(168px,28vh,220px)]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 12, left: 8, bottom: 0 }}
              barCategoryGap="18%"
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <defs>
                {PIPELINE.map((stage) => (
                  <linearGradient
                    key={stage.gradientId}
                    id={stage.gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={stage.gradientFrom} />
                    <stop offset="100%" stopColor={stage.gradientTo} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: "#334155", fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: "#cbd5e1" }}
                tickLine={false}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={56}
                tickMargin={6}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, yMax]}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={32}
                tickCount={yMax + 1}
              >
                <Label
                  value="Jobs"
                  angle={-90}
                  position="insideLeft"
                  offset={12}
                  style={{
                    fill: "#64748b",
                    fontSize: 11,
                    fontWeight: 600,
                    textAnchor: "middle",
                  }}
                />
              </YAxis>
              <Tooltip
                content={<PipelineTooltip />}
                cursor={{ fill: "rgba(245, 158, 11, 0.1)", radius: 6 }}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                maxBarSize={56}
                animationDuration={600}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={entry.status}
                    fill={`url(#${entry.gradientId})`}
                    opacity={
                      activeIndex === undefined || activeIndex === index
                        ? 1
                        : 0.35
                    }
                    style={{
                      filter:
                        activeIndex === index
                          ? "drop-shadow(0 4px 6px rgb(0 0 0 / 0.12))"
                          : undefined,
                    }}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  offset={6}
                  className="text-sm font-bold"
                  fill="#0f172a"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-xs text-slate-500">
          Vertical scale = number of programs in each stage (0-{yMax})
        </p>
      </div>
    </div>
  );
}


