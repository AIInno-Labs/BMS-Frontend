"use client";

import { Loader2 } from "lucide-react";

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

const SPINNER_SIZES: Record<SpinnerSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

/** Bare spinning icon - compose it wherever a loading state needs an indicator. */
export function Spinner({
  size = "md",
  className = "",
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <Loader2
      className={`animate-spin text-slate-400 ${SPINNER_SIZES[size]} ${className}`}
      aria-hidden
    />
  );
}

/** Centered spinner for a full page/section wait - auth gates, route guards, Suspense fallbacks. */
export function LoadingState({
  label,
  size = "lg",
  className = "",
}: {
  label?: string;
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Spinner size={size} />
      {label ? <p className="text-sm text-slate-600">{label}</p> : null}
    </div>
  );
}

/** Small inline spinner (+ optional caption) for a line of text mid-layout. */
export function InlineLoading({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-slate-500 ${className}`}>
      <Spinner size="xs" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

/** Base pulsing placeholder block - compose into row/line shapes below. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

/** One skeleton table row with `columns` cells - drops straight into an existing <tbody>. */
export function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[10rem]" />
        </td>
      ))}
    </tr>
  );
}

/** A handful of stacked skeleton rows for a table body loading state. */
export function SkeletonRows({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </>
  );
}

/** One card matching a labeled section header + skeleton table body (the
 *  category cards used across the notification-rules pages). */
export function SkeletonSection({
  columns = 4,
  rows = 3,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <table className="w-full text-left text-sm">
        <tbody>
          <SkeletonRows columns={columns} rows={rows} />
        </tbody>
      </table>
    </section>
  );
}

/** A stack of `SkeletonSection` cards for a page that loads several category groups. */
export function SkeletonSections({
  count = 3,
  columns = 4,
  rowsPerSection = 3,
}: {
  count?: number;
  columns?: number;
  rowsPerSection?: number;
}) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonSection key={i} columns={columns} rows={rowsPerSection} />
      ))}
    </div>
  );
}
