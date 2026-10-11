"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  Circle,
  Download,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Send,
  Upload,
  User,
} from "lucide-react";
import { formatShortDate } from "@/lib/mockData";
import type { Job, JobPriority } from "@/lib/types";
import { getWorkerDisplayName } from "@/lib/workers";

function getStageLabel(status: Job["status"]): string {
  if (status === "In Fabrication") return "MANUFACTURING";
  if (status === "Complete") return "DELIVERED";
  return "NOT STARTED";
}

function getStageBadgeClass(status: Job["status"]): string {
  if (status === "Complete") {
    return "border-[#86EFAC] bg-[#DCFCE7] text-[#166534]";
  }
  if (status === "In Fabrication") {
    return "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]";
  }
  return "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]";
}

function getPriorityBadgeClass(priority: JobPriority): string {
  if (priority === "RUSH" || priority === "High") {
    return "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]";
  }
  return "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]";
}

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

export interface JobDetailsViewProps {
  job: Job;
  isManager: boolean;
  isEditing: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess?: boolean;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onPostNote: () => void;
  onEdit: () => void;
  onUpdateStatus: () => void;
  onPrint: () => void;
}

export function JobDetailsView({
  job,
  isManager,
  isEditing,
  isSaving,
  saveError,
  saveSuccess,
  noteDraft,
  onNoteDraftChange,
  onPostNote,
  onEdit,
  onUpdateStatus,
  onPrint,
}: JobDetailsViewProps) {
  const pd = job.printDetails;
  const phone = pd?.contactPhone?.trim() || "—";
  const email = pd?.contactEmail?.trim() || "—";
  const address =
    pd?.deliveryInstructions?.trim() ||
    [pd?.transportCompany, pd?.freightAccount].filter(Boolean).join(" · ") ||
    "—";

  const assignedStaff = [
    job.assignedWorkerName || getWorkerDisplayName(job.assignedWorkerId),
  ].filter((name) => name && name !== "—");

  const timeline = [
    { label: "Job Created", done: true },
    {
      label: "Manufacturing Started",
      done: job.status === "In Fabrication" || job.status === "Complete",
    },
    {
      label: "Delivery Scheduled",
      done: Boolean(job.dueDate),
    },
    { label: "Delivered", done: job.status === "Complete" },
  ];

  const hasFileHint = Boolean(pd?.scopeLines?.length || pd?.purchaseOrderNo);

  return (
    <div className="no-print mx-auto w-full min-w-0 max-w-6xl px-3 py-3 sm:px-6 sm:py-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-[#2563EB]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Back to Jobs
      </Link>

      {saveError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {saveError}
        </p>
      )}
      {saveSuccess && !saveError && (
        <p className="mt-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#1D4ED8]">
          Job card saved. Export PDF to see your latest changes.
        </p>
      )}

      <section className="mt-4 rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                {job.id}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStageBadgeClass(job.status)}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                {getStageLabel(job.status)}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-[#0F172A]">{job.clientName}</p>
            <p className="mt-0.5 text-sm text-slate-600">{job.projectName}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
              {formatDueLine(job)}
            </p>
          </div>

          {isManager && (
            <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:flex lg:w-auto lg:flex-wrap">
              <button
                type="button"
                onClick={onEdit}
                disabled={isEditing}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:opacity-50 lg:min-h-[36px] lg:w-auto"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit Job
              </button>
              <button
                type="button"
                onClick={onUpdateStatus}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-[#0F172A] transition-colors hover:bg-[#F8FAFC] lg:min-h-[36px] lg:w-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Update Status
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 text-[11px] font-semibold uppercase tracking-wide text-[#0F172A] transition-colors hover:bg-[#F8FAFC] lg:min-h-[36px] lg:w-auto"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export PDF
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0F172A]">Job Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Project Name
                </dt>
                <dd className="mt-0.5 font-medium text-[#0F172A]">{job.projectName}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Assigned Staff
                </dt>
                <dd className="mt-0.5 text-[#0F172A]">
                  {assignedStaff.length > 0 ? assignedStaff.join(", ") : "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </dt>
                <dd className="mt-0.5 leading-relaxed text-slate-700">
                  {job.manualInstructions?.trim() ||
                    job.alert ||
                    "No description provided."}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Priority
                </dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getPriorityBadgeClass(job.priority)}`}
                  >
                    {job.priority}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0F172A]">Job Timeline</h2>
            <ul className="mt-3 space-y-2.5">
              {timeline.map((step) => (
                <li
                  key={step.label}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {step.done ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300" aria-hidden />
                    )}
                    <span className="truncate text-sm font-medium text-[#0F172A]">{step.label}</span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      step.done
                        ? "bg-[#DCFCE7] text-[#166534]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {step.done ? "Done" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0F172A]">Customer Details</h2>
            <ul className="mt-3 space-y-3">
              <CustomerRow
                icon={User}
                label="Contact"
                value={job.clientContactName || "—"}
              />
              <CustomerRow icon={Phone} label="Phone" value={phone} />
              <CustomerRow icon={Mail} label="Email" value={email} />
              <CustomerRow icon={MapPin} label="Address" value={address} />
            </ul>
          </section>

          <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0F172A]">Files</h2>
            {hasFileHint ? (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0F172A]">
                      {pd?.purchaseOrderNo
                        ? `PO-${pd.purchaseOrderNo}.pdf`
                        : "Job specification.pdf"}
                    </p>
                    <p className="text-[11px] text-slate-500">Attached document</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onPrint}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E2E8F0] text-slate-500 hover:bg-white"
                  aria-label="Download file"
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <p className="mt-2 hidden text-xs text-slate-500">No files uploaded.</p>
            )}
            <button
              type="button"
              className="mt-3 inline-flex w-full min-h-[38px] items-center justify-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-semibold uppercase tracking-wide text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Upload File
            </button>
          </section>
        </div>
      </div>

      <section className="mt-4 rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#0F172A]">Notes</h2>
        {job.manualInstructions?.trim() && (
          <article className="mt-3 flex gap-3 border-b border-[#E2E8F0] pb-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-semibold text-[#1D4ED8]">
              MGR
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#0F172A]">Job card notes</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {job.manualInstructions}
              </p>
            </div>
          </article>
        )}
        {job.createdAt && (
          <article className="mt-3 flex gap-3 border-b border-[#E2E8F0] pb-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-semibold text-[#1D4ED8]">
              SYS
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#0F172A]">System</p>
                <p className="text-xs text-slate-500">{formatShortDate(job.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                Job created and added to the fabrication queue.
              </p>
            </div>
          </article>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={noteDraft}
            onChange={(e) => onNoteDraftChange(e.target.value)}
            placeholder="Add a note for the team..."
            className="min-h-[42px] w-full min-w-0 flex-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 text-sm text-[#0F172A] outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          />
          <button
            type="button"
            onClick={onPostNote}
            disabled={isSaving}
            className="inline-flex min-h-[42px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#2563EB] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60 sm:w-auto"
          >
            <Send className="h-4 w-4" aria-hidden />
            Post
          </button>
        </div>
      </section>
    </div>
  );
}

function CustomerRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm font-medium text-[#0F172A]">{value}</p>
      </div>
    </li>
  );
}
