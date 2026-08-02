"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { getReadyToManufactureChartData } from "@/lib/mockData";
import { STATUS_THEME } from "@/lib/statusColors";
import type { Job } from "@/lib/types";

const CHART_COLORS = {
  Yes: STATUS_THEME.manufacturing.strong,
  No: STATUS_THEME.notStarted.soft,
};

interface ReadyToManufacturePieChartProps {
  jobs: Job[];
  compact?: boolean;
}

function ActiveSlice(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius ?? 0) + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export function ReadyToManufacturePieChart({
  jobs,
  compact = false,
}: ReadyToManufacturePieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const data = useMemo(
    () =>
      getReadyToManufactureChartData(jobs).map((d) => ({
        ...d,
        fill: CHART_COLORS[d.name as keyof typeof CHART_COLORS] ?? "#94a3b8",
      })),
    [jobs]
  );

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const yesCount = data.find((d) => d.name === "Yes")?.value ?? 0;
  const readyPct = total > 0 ? Math.round((yesCount / total) * 100) : 0;

  const centerValue =
    activeIndex !== undefined ? data[activeIndex].value : yesCount;
  const centerLabel =
    activeIndex !== undefined
      ? data[activeIndex].name === "Yes"
        ? "Ready"
        : "Not ready"
      : `${readyPct}% ready`;

  if (compact) {
    return (
      <div className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm max-lg:flex-none lg:min-h-0 lg:flex-1">
        <h2 className="shrink-0 text-left text-xs font-semibold leading-tight tracking-tight text-slate-900">
          Ready to Manufacture
        </h2>

        <div className="mt-1 grid min-w-0 grid-cols-1 items-center gap-1.5 sm:grid-cols-[106px_minmax(0,1fr)]">
          <div className="relative mx-auto h-[90px] w-[90px] sm:h-[96px] sm:w-[96px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="84%"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="#fff"
                  strokeWidth={2}
                  activeIndex={activeIndex}
                  activeShape={ActiveSlice}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={entry.fill}
                      opacity={
                        activeIndex === undefined || activeIndex === index
                          ? 1
                          : 0.4
                      }
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              role="status"
              aria-live="polite"
            >
              <span className="text-base font-bold tabular-nums text-slate-900">
                {centerValue}
              </span>
              <span className="mt-0.5 max-w-20 text-center text-[10px] font-medium leading-tight text-slate-600">
                {centerLabel}
              </span>
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            {data.map((entry, index) => {
              const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
              const label = entry.name === "Yes" ? "Ready" : "Not ready";
              return (
                <button
                  key={entry.name}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(undefined)}
                  className={`flex w-full items-center justify-between rounded-md border px-1.5 py-1 text-left transition-colors ${
                    activeIndex === index
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                      aria-hidden
                    />
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      {label}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-slate-900">{entry.value}</span>
                    <span className="text-slate-500">{pct}%</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-card flex h-full min-w-0 flex-col overflow-hidden">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Ready to Manufacture
      </h2>
      <p className="mt-0.5 text-base text-slate-600">
        Yes / No - current production queue
      </p>
      <div className="mt-6 min-h-[280px] w-full min-w-0 flex-1 sm:min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={76}
              outerRadius={112}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              stroke="transparent"
              activeIndex={activeIndex}
              activeShape={ActiveSlice}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: 500,
                color: "#0f172a",
              }}
              formatter={(value: number, name: string) => [
                `${value} job${value !== 1 ? "s" : ""}`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}




