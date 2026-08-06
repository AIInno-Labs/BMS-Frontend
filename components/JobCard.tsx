"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Camera,
  Clock,
  Download,
  FlaskConical,
  Lock,
  Pencil,
  Save,
  User,
  UserCircle,
  StickyNote,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { AiButton } from "@/components/ai/AiButton";
import { InlineSmartHint } from "@/components/InlineSmartHint";
import { AiFieldBadge } from "@/components/ai/AiFieldBadge";
import { JobWorkflowDashboard } from "@/components/JobWorkflowDashboard";
import { JobQrCode } from "@/components/JobQrCode";
import { PriorityAlertsCell } from "@/components/PriorityAlertsCell";
import { ActivityAuditTrail } from "@/components/ActivityAuditTrail";
import { printJobCardPdf } from "@/lib/openJobCardPdfPrint";
import { JobCardPrintDetailsForm } from "@/components/JobCardPrintDetailsForm";
import { JobCardQuotientPanel } from "@/components/JobCardQuotientPanel";
import { ensurePrintDetails } from "@/lib/jobCardFormDefaults";
import type { JobCardPrintDetails } from "@/lib/types";
import { QaTraceabilitySection } from "@/components/QaTraceabilitySection";
import { StatusBadge } from "@/components/StatusBadge";
import { useJobs } from "@/context/JobsContext";
import { usePersona } from "@/context/PersonaContext";
import { generateAiEstimate } from "@/lib/aiMock";
import {
  formatEstimatedHoursLong,
  formatShortDate,
  formatYesNo,
  jobPriorities,
  jobStatuses,
  resinTypes,
} from "@/lib/mockData";
import type { JobUpdateAuditAction } from "@/lib/frp/job-mapper";
import { downloadJobCard, getQuote } from "@/lib/frp/api";
import type {
  Job,
  JobPriority,
  JobSchedulingLogistics,
  JobStatus,
  ResinType,
  ShipmentMethod,
} from "@/lib/types";
import {
  getAssignableWorkers,
  getWorkerDisplayName,
  resolveWorkerNameFromId,
} from "@/lib/workers";

interface JobCardProps {
  jobId: string;
}

export function JobCard({ jobId }: JobCardProps) {
  const { jobs, getJobById, loadJobDetail, updateJob, hydrated, loading, error } =
    useJobs();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearingAlert, setIsClearingAlert] = useState(false);
  const { isManager, isWorker, workerId, workerName } = usePersona();
  const searchParams = useSearchParams();
  const editFromUrlApplied = useRef(false);
  const sourceJob = getJobById(jobId);

  const [job, setJob] = useState<Job | null>(sourceJob ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Job | null>(sourceJob ?? null);
  const [aiSuggestedMaterial, setAiSuggestedMaterial] = useState<string | null>(
    null
  );
  const [aiFieldsActive, setAiFieldsActive] = useState(false);
  const [isAiEstimating, setIsAiEstimating] = useState(false);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [qaPhotoCaptured, setQaPhotoCaptured] = useState(false);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!sourceJob || isSaving) return;
    setJob(sourceJob);
    if (!isEditing) setDraft(sourceJob);
  }, [sourceJob, isEditing, isSaving]);

  // `getJobById` only ever has the `GET /jobs` list projection, which the
  // backend deliberately strips of customer/contact detail to keep the list
  // payload small. Fetch the full record once per job so customer contact,
  // stages, etc. show up here. Guarded by a ref (not just the jobId dep)
  // because `loadJobDetail`'s identity changes on every jobs-list update, and
  // without the guard that would refetch on every list refresh.
  const detailFetchedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !jobId) return;
    if (detailFetchedForRef.current === jobId) return;
    detailFetchedForRef.current = jobId;
    void loadJobDetail(jobId).catch(() => {
      detailFetchedForRef.current = null;
    });
  }, [jobId, hydrated, loadJobDetail]);

  useEffect(() => {
    if (!isWorker) return;
    if (isEditing) {
      setIsEditing(false);
    }
    setAiSuggestedMaterial(null);
    setAiFieldsActive(false);
    setIsAiEstimating(false);
  }, [isWorker, isEditing]);

  useEffect(() => {
    if (editFromUrlApplied.current) return;
    if (searchParams.get("edit") !== "1" || !isManager || isWorker || !sourceJob) return;
    editFromUrlApplied.current = true;
    const base = { ...sourceJob, printDetails: ensurePrintDetails(sourceJob) };
    setDraft(base);
    setIsEditing(true);

    const qMatch = /^JOB-Q-(.+)$/i.exec(sourceJob.id);
    if (!qMatch) return;
    void getQuote(qMatch[1])
      .then((raw) => {
        if (!raw) return;
        const q = raw as {
          accepted_order_number?: string;
          acceptedOrderNumber?: string;
          quote_for_phone?: string;
          quoteForPhone?: string;
          quote_for_email?: string;
          quoteForEmail?: string;
          quote_for_contact_name?: string;
          quoteForContactName?: string;
        };
        setDraft((d) => {
          if (!d) return d;
          const pd = { ...ensurePrintDetails(d) };
          const po = q.accepted_order_number ?? q.acceptedOrderNumber;
          const phone = q.quote_for_phone ?? q.quoteForPhone;
          const email = q.quote_for_email ?? q.quoteForEmail;
          const contact =
            q.quote_for_contact_name ?? q.quoteForContactName;
          if (po && !pd.purchaseOrderNo) pd.purchaseOrderNo = po;
          if (phone && !pd.contactPhone) pd.contactPhone = phone;
          if (email && !pd.contactEmail) pd.contactEmail = email;
          return {
            ...d,
            clientContactName: d.clientContactName || contact || "",
            printDetails: pd,
          };
        });
      })
      .catch(() => {});
  }, [searchParams, isManager, isWorker, sourceJob]);

  const aiEstimateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (aiEstimateTimeoutRef.current) {
        clearTimeout(aiEstimateTimeoutRef.current);
      }
    };
  }, []);

  if (hydrated && !loading && !sourceJob) {
    notFound();
  }

  if (loading || !job || !draft) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center bg-slate-50">
        <p className="text-base text-slate-600">
          {error ?? "Loading job card from database…"}
        </p>
      </main>
    );
  }

  const isReadOnly = isWorker || !isEditing;
  const workerMayView =
    !isWorker ||
    (job.assignedWorkerId === workerId &&
      (job.status === "Ready to Manufacture" ||
        job.status === "In Fabrication"));

  if (isWorker && !workerMayView) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-6 text-center">
          <p className="text-lg font-semibold text-[#1D4ED8]">
            This job is not assigned to you
          </p>
          <p className="mt-2 text-base text-[#2563EB]">
            Signed in as {workerName}. Ask your manager to assign this program
            before you can open the job card.
          </p>
          <Link href="/jobs" className="btn-primary mt-6 inline-flex">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Back to My Work
          </Link>
        </div>
      </main>
    );
  }

  const jobNumber = job.id.replace("JOB-", "");
  const display = isEditing ? draft : job;
  const assignableWorkers = getAssignableWorkers();

  const handlePrint = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (!job.dbId) {
        throw new Error("Job has no database id — reload the job list.");
      }
      // The print route resolves jobs by database id, not job number.
      await printJobCardPdf(job.dbId);
      // Log the pull for the audit trail (JOB_CARD_DOWNLOADED). Best-effort:
      // the card is already open, so a failed audit must not surface an error.
      void downloadJobCard(job.dbId).catch(() => {});
    } catch {
      setSaveError("Could not open job card PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const toSave = {
        ...draft,
        printDetails: ensurePrintDetails(draft),
      };
      const saved = await updateJob(toSave, "job_card_saved");
      const merged = {
        ...saved,
        printDetails: ensurePrintDetails(saved),
      };
      setJob(merged);
      setDraft(merged);
      setIsEditing(false);
      setSaveSuccess(true);
      setAuditRefreshKey((k) => k + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save job card");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDraft(job);
    setIsEditing(false);
  };

  const handleClearAlert = async () => {
    if (!job.alert) return;
    setSaveError(null);
    setIsClearingAlert(true);
    try {
      const saved = await updateJob({ ...job, alert: null }, "alert_cleared");
      setJob(saved);
      setDraft((d) => (d ? { ...d, alert: null } : saved));
      setAuditRefreshKey((k) => k + 1);
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Could not clear priority alert"
      );
    } finally {
      setIsClearingAlert(false);
    }
  };

  const handleAiEstimate = () => {
    if (isAiEstimating) return;
    if (aiEstimateTimeoutRef.current) clearTimeout(aiEstimateTimeoutRef.current);
    setIsAiEstimating(true);
    setAiFieldsActive(false);
    aiEstimateTimeoutRef.current = setTimeout(() => {
      const result = generateAiEstimate(job);
      const updated = { ...job, estimatedHours: result.estimatedHours };
      setJob(updated);
      setDraft(updated);
      void updateJob(updated, "ai_estimate").catch(() => {
        /* AI estimate still updates local state */
      });
      setAuditRefreshKey((k) => k + 1);
      setAiSuggestedMaterial(result.aiSuggestedMaterial);
      setAiFieldsActive(true);
      setIsAiEstimating(false);
      aiEstimateTimeoutRef.current = null;
    }, 1500);
  };

  const patchDraft = (patch: Partial<Job>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const patchPrintDetails = (printDetails: JobCardPrintDetails) =>
    setDraft((d) => (d ? { ...d, printDetails } : d));

  const EMPTY_SCHEDULING_LOGISTICS: JobSchedulingLogistics = {
    jobStatus: null,
    responsiblePersonId: null,
    accountable: null,
    contactId: null,
    shipDate: null,
    shipmentMethod: null,
    freightAccount: null,
    carrierAccount: null,
    billingAddress: null,
    deliveryAddress: null,
  };

  const patchSchedulingLogistics = (patch: Partial<JobSchedulingLogistics>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            schedulingLogistics: {
              ...EMPTY_SCHEDULING_LOGISTICS,
              ...(d.schedulingLogistics ?? {}),
              ...patch,
            },
          }
        : d
    );

  const SHIPMENT_METHOD_OPTIONS: { value: ShipmentMethod; label: string }[] = [
    { value: "INHOUSE_DELIVERY", label: "In-house delivery" },
    { value: "CUSTOMER_COLLECT", label: "Customer collect" },
    { value: "THIRD_PARTY_COURIER", label: "Third-party courier" },
    { value: "FREIGHT_FORWARDER", label: "Freight forwarder" },
    { value: "OTHER", label: "Other" },
  ];

  const startEditing = () => {
    setSaveSuccess(false);
    const base = { ...job, printDetails: ensurePrintDetails(job) };
    setDraft(base);
    setIsEditing(true);

    const qMatch = /^JOB-Q-(.+)$/i.exec(job.id);
    if (!qMatch) return;
    void getQuote(qMatch[1])
      .then((raw) => {
        if (!raw) return;
        const q = raw as {
          accepted_order_number?: string;
          acceptedOrderNumber?: string;
          quote_for_phone?: string;
          quoteForPhone?: string;
          quote_for_email?: string;
          quoteForEmail?: string;
          quote_for_contact_name?: string;
          quoteForContactName?: string;
        };
        setDraft((d) => {
          if (!d) return d;
          const pd = { ...ensurePrintDetails(d) };
          const po = q.accepted_order_number ?? q.acceptedOrderNumber;
          const phone = q.quote_for_phone ?? q.quoteForPhone;
          const email = q.quote_for_email ?? q.quoteForEmail;
          const contact =
            q.quote_for_contact_name ?? q.quoteForContactName;
          if (po && !pd.purchaseOrderNo) pd.purchaseOrderNo = po;
          if (phone && !pd.contactPhone) pd.contactPhone = phone;
          if (email && !pd.contactEmail) pd.contactEmail = email;
          return {
            ...d,
            clientContactName: d.clientContactName || contact || "",
            printDetails: pd,
          };
        });
      })
      .catch(() => {});
  };

  const aiFieldClass =
    "border border-violet-300 bg-violet-50 ring-1 ring-violet-200";

  const inputClass =
    "mt-1.5 w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  const handleSavePatch = async (
    patch: Partial<Job>,
    options?: { audit?: JobUpdateAuditAction; auditDetail?: string | null }
  ) => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const next = {
        ...job,
        ...patch,
        printDetails: ensurePrintDetails({
          ...job,
          ...patch,
        }),
      };
      const saved = await updateJob(
        next,
        options?.audit ?? "job_card_saved",
        options?.auditDetail
      );
      setJob(saved);
      setDraft(saved);
      setSaveSuccess(true);
      setAuditRefreshKey((k) => k + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main
      className={`min-h-screen overflow-x-hidden bg-slate-50 print:min-h-0 print:overflow-visible print:bg-white ${isWorker ? "worker-ui" : ""}`}
    >
      {isEditing && isManager && (
        <div className="no-print sticky top-0 z-40 border-b border-[#BFDBFE] bg-[#EFF6FF]/95 px-3 py-3 shadow-sm backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#1D4ED8]">Editing job card — save to update PDF</p>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden />
                {isSaving ? "Saving…" : "Save Job Card"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
          {saveError && (
            <p className="mx-auto mt-2 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {saveError}
            </p>
          )}
        </div>
      )}

      {!isEditing && (
        <JobWorkflowDashboard
          job={display}
          isSaving={isSaving}
          isExporting={isExporting}
          saveError={saveError}
          saveSuccess={saveSuccess}
          auditRefreshKey={auditRefreshKey}
          onPrint={handlePrint}
          onSavePatch={handleSavePatch}
        />
      )}

      {isWorker && !isEditing && (
        <>
        <p className="no-print mx-auto mb-4 max-w-6xl rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2 text-sm font-medium text-[#1D4ED8] sm:px-6">
          Viewing as {workerName} — job card is read-only. Contact your manager to
          request changes.
        </p>
          <footer className="no-print mx-auto mb-8 max-w-6xl rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-5 shadow-sm sm:px-6">
            <div className="flex flex-col gap-4">
              {jobCompleted ? (
                <p className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-center font-semibold text-[#1D4ED8]">
                  Job marked complete — sent to manager for sign-off.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setQaPhotoCaptured(true)}
                    className={`inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border px-6 py-4 text-base font-semibold ${
                      qaPhotoCaptured
                        ? "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]"
                        : "border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm"
                    }`}
                  >
                    <Camera className="h-6 w-6" aria-hidden />
                    {qaPhotoCaptured ? "QA Photo Captured" : "Capture QA Photo (Required)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobCompleted(true)}
                    disabled={!qaPhotoCaptured}
                    className="inline-flex min-h-[56px] w-full items-center justify-center rounded-xl bg-[#2563EB] text-base font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    Mark Job as Complete
                  </button>
                </>
              )}
            </div>
          </footer>
        </>
      )}

      <div
        className={`mx-auto w-full min-w-0 px-4 py-5 print:max-w-none print:p-0 sm:px-6 sm:py-8 ${
          isEditing ? "max-w-3xl" : "hidden"
        }`}
      >
        {isEditing && (
          <Link href="/jobs" className="no-print btn-ghost mb-4">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Back to Jobs
          </Link>
        )}

        <article
          id="job-card-print"
          className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-md print:overflow-visible print:rounded-none print:border-0 print:shadow-none"
        >
          <div className="no-print">
          <header className="relative border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium uppercase tracking-widest text-blue-600 print:text-slate-700">
                  Factory Job Card
                </p>
                <p className="text-sm text-slate-500">FRP Engineering</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Job #{jobNumber}
                </h1>
                <p className="mt-1 text-base font-medium text-slate-700 sm:text-lg">
                  {display.projectName}
                </p>
                <p className="mt-0.5 text-base text-slate-600">
                  {display.clientName}
                </p>
              </div>

              {isManager && (
                <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto lg:min-w-[200px]">
                  {isEditing ? (
                    <>
                      {saveError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                          {saveError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={isSaving}
                        className="btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Save className="h-5 w-5 shrink-0" aria-hidden />
                        {isSaving ? "Saving…" : "Save Job Card"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="btn-secondary min-h-[48px] w-full justify-center"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row lg:flex-col">
                      <button
                        type="button"
                        onClick={startEditing}
                        className="btn-secondary min-h-[48px] w-full flex-1 justify-center"
                      >
                        <Pencil className="h-5 w-5" aria-hidden />
                        Edit details
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        disabled={isExporting}
                        aria-busy={isExporting}
                        className="btn-primary min-h-[48px] w-full flex-1 justify-center disabled:cursor-wait disabled:opacity-80"
                      >
                        <Download className="h-5 w-5" aria-hidden />
                        {isExporting ? "Exporting…" : "Download PDF"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          {isManager && (
            <div className="no-print space-y-3 border-b border-violet-200 bg-violet-50 px-5 py-4 sm:px-6">
              <InlineSmartHint variant="indigo">
                AI estimates resin and man-hours from historical composite data.
              </InlineSmartHint>
              <AiButton onClick={handleAiEstimate} loading={isAiEstimating}>
                AI: Auto-Estimate Materials &amp; Time
              </AiButton>
            </div>
          )}

          <div className="min-w-0 space-y-5 px-4 py-5 print:space-y-4 print:p-5 sm:px-6">
            <div className="no-print space-y-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <StatusBadge status={display.status} />
                <PriorityAlertsCell job={display} layout="inline" showAlert={false} />
                {display.assignedWorkerId && (
                  <span className="inline-flex max-w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium leading-snug text-slate-700">
                    Assigned: {getWorkerDisplayName(display.assignedWorkerId)}
                  </span>
                )}
              </div>
              {job.alert && (
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="flex items-start gap-2 text-sm font-semibold text-amber-900 sm:text-base">
                      <span className="shrink-0" aria-hidden>
                        ⚠️
                      </span>
                      <span className="min-w-0 break-words">{job.alert}</span>
                    </p>
                  </div>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => void handleClearAlert()}
                      disabled={isClearingAlert || isSaving}
                      className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                      title="Remove this alert from the job register"
                    >
                      <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {isClearingAlert ? "Clearing…" : "Clear alert"}
                    </button>
                  )}
                </div>
              )}
              {saveError && !isEditing && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {saveError}
                </p>
              )}
            </div>

            {job.id.startsWith("JOB-Q-") && (
              <JobCardQuotientPanel jobId={job.id} />
            )}

            <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 print:border-slate-300 print:bg-white">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Locked program identity (factory job card)
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:items-stretch">
                <LockedField label="Job ID" value={display.id} />
                <LockedField label="title (from Quotient)" value={display.projectName} />
                <LockedField label="quote_for company" value={display.clientName} />
              </div>
            </section>

            <section className="grid min-w-0 gap-4 sm:grid-cols-2">
              <FieldBlock
                label="Due date"
                icon={Calendar}
                isEditing={isEditing && isManager}
              >
                {isEditing && isManager ? (
                  <input
                    type="date"
                    value={draft.dueDate ?? ""}
                    onChange={(e) =>
                      patchDraft({
                        dueDate: e.target.value.trim() || null,
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p
                    className={`text-base font-semibold ${
                      display.dueDate ? "text-slate-900" : "text-amber-700"
                    }`}
                  >
                    {display.dueDate
                      ? formatShortDate(display.dueDate)
                      : "Not set — edit to add factory due date"}
                  </p>
                )}
              </FieldBlock>

              <FieldBlock label="Valid until (from Quotient)" icon={Calendar}>
                <p className="text-base font-semibold text-slate-900">
                  {formatShortDate(display.quoteValidUntil)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Sales quote expiry — read-only
                </p>
              </FieldBlock>

              <FieldBlock label="Date received" icon={Calendar}>
                {isEditing && isManager ? (
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => patchDraft({ date: e.target.value })}
                    className={inputClass}
                  />
                ) : (
                  <p className="text-base font-semibold text-slate-900">
                    {formatShortDate(display.date)}
                  </p>
                )}
              </FieldBlock>

              <FieldBlock label="Client contact" icon={UserCircle}>
                {isEditing && isManager ? (
                  <input
                    type="text"
                    value={draft.clientContactName}
                    onChange={(e) =>
                      patchDraft({ clientContactName: e.target.value })
                    }
                    placeholder="Site contact name"
                    className={inputClass}
                  />
                ) : (
                  <p className="text-base font-semibold text-slate-900">
                    {display.clientContactName || "—"}
                  </p>
                )}
              </FieldBlock>

              <FieldBlock label="Assigned worker" icon={User}>
                {isEditing && isManager ? (
                  <select
                    value={draft.assignedWorkerId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      patchDraft({
                        assignedWorkerId: id,
                        assignedWorkerName: resolveWorkerNameFromId(id),
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">Unassigned</option>
                    {assignableWorkers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-base font-semibold text-slate-900">
                    {display.assignedWorkerName ||
                      getWorkerDisplayName(display.assignedWorkerId)}
                  </p>
                )}
              </FieldBlock>
            </section>

            <section className="rounded-xl border border-slate-200 p-4 print:border-slate-300">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Program requirements
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <YesNoField
                  label="Manufacturing required"
                  checked={
                    isEditing && isManager
                      ? draft.manufacturingRequired
                      : display.manufacturingRequired
                  }
                  disabled={isReadOnly || !isManager}
                  onChange={(v) => patchDraft({ manufacturingRequired: v })}
                />
                <YesNoField
                  label="Install required"
                  checked={
                    isEditing && isManager
                      ? draft.installRequired
                      : display.installRequired
                  }
                  disabled={isReadOnly || !isManager}
                  onChange={(v) => patchDraft({ installRequired: v })}
                />
                <YesNoField
                  label="QA completed"
                  checked={
                    isEditing && isManager ? draft.qaCompleted : display.qaCompleted
                  }
                  disabled={isReadOnly || !isManager}
                  onChange={(v) => patchDraft({ qaCompleted: v })}
                />
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <FieldBlock label="Resin type" icon={FlaskConical}>
                {isEditing && isManager ? (
                  <select
                    value={draft.resinType}
                    onChange={(e) =>
                      patchDraft({ resinType: e.target.value as ResinType })
                    }
                    className={inputClass}
                  >
                    {resinTypes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-base font-semibold text-slate-900">
                    {display.resinType}
                  </p>
                )}
              </FieldBlock>

              <FieldBlock label="Est. fabrication hours" icon={Clock}>
                {isEditing && isManager ? (
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={draft.estimatedHours ?? ""}
                    onChange={(e) =>
                      patchDraft({
                        estimatedHours:
                          e.target.value === ""
                            ? null
                            : parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClass}
                  />
                ) : (
                  <p
                    className={`text-base font-semibold ${
                      display.estimatedHours == null
                        ? "text-amber-700"
                        : "text-slate-900"
                    }`}
                  >
                    {formatEstimatedHoursLong(display.estimatedHours)}
                  </p>
                )}
              </FieldBlock>

              {isEditing && isManager ? (
                <>
                  <FieldBlock label="Status">
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        patchDraft({ status: e.target.value as JobStatus })
                      }
                      className={inputClass}
                    >
                      {jobStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="Priority">
                    <select
                      value={draft.priority}
                      onChange={(e) =>
                        patchDraft({ priority: e.target.value as JobPriority })
                      }
                      className={inputClass}
                    >
                      {jobPriorities.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                </>
              ) : null}
            </section>

            <JobCardPrintDetailsForm
              job={display}
              allJobs={jobs}
              disabled={isReadOnly || !isManager}
              onChange={patchPrintDetails}
            />

            {isManager && (isAiEstimating || aiSuggestedMaterial) && (
              <div
                className={`no-print rounded-xl p-4 ${
                  isAiEstimating ? "bg-violet-50" : aiFieldClass
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-600">
                    AI suggested material
                  </p>
                  {aiFieldsActive && !isAiEstimating && <AiFieldBadge />}
                </div>
                {isAiEstimating ? (
                  <div className="mt-2 h-5 animate-pulse rounded bg-violet-200" />
                ) : (
                  aiSuggestedMaterial && (
                    <p className="mt-1 font-semibold text-slate-900">
                      {aiSuggestedMaterial}
                    </p>
                  )
                )}
              </div>
            )}

            <section className="rounded-xl border border-slate-200 p-4 print:border-slate-300">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Wrench className="h-4 w-4" aria-hidden />
                Manual fabrication instructions
              </h2>
              {isEditing && isManager ? (
                <textarea
                  value={draft.manualInstructions}
                  onChange={(e) =>
                    patchDraft({ manualInstructions: e.target.value })
                  }
                  rows={4}
                  className={`${inputClass} mt-2 min-h-[100px] resize-y`}
                  placeholder="Lay-up notes, safety, sign-off requirements…"
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                  {display.manualInstructions || "—"}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 p-4 print:border-slate-300">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <StickyNote className="h-4 w-4" aria-hidden />
                Notes
              </h2>
              {isEditing ? (
                <textarea
                  value={draft.notes ?? ""}
                  onChange={(e) =>
                    patchDraft({ notes: e.target.value || null })
                  }
                  rows={4}
                  className={`${inputClass} mt-2 min-h-[100px] resize-y`}
                  placeholder="Working notes for this job…"
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                  {display.notes || "—"}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 p-4 print:border-slate-300">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Truck className="h-4 w-4" aria-hidden />
                Scheduling &amp; logistics
              </h2>
              {isEditing ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-slate-500">Logistics status</span>
                    <select
                      value={draft.schedulingLogistics?.jobStatus ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({ jobStatus: e.target.value || null })
                      }
                      className={`${inputClass} mt-1`}
                    >
                      <option value="">—</option>
                      {[
                        "PENDING",
                        "AWAITING_MANAGER_APPROVAL",
                        "READY_TO_MANUFACTURE",
                        "IN_FABRICATION",
                        "ON_HOLD",
                        "COMPLETE",
                        "CANCELLED",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-500">Shipment method</span>
                    <select
                      value={draft.schedulingLogistics?.shipmentMethod ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({
                          shipmentMethod:
                            (e.target.value as ShipmentMethod) || null,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    >
                      <option value="">—</option>
                      {SHIPMENT_METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-500">Ship date</span>
                    <input
                      type="date"
                      value={draft.schedulingLogistics?.shipDate ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({ shipDate: e.target.value || null })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-500">Responsible person (user id)</span>
                    <input
                      type="number"
                      value={draft.schedulingLogistics?.responsiblePersonId ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({
                          responsiblePersonId: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-500">Accountable</span>
                    <input
                      type="text"
                      value={draft.schedulingLogistics?.accountable ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({ accountable: e.target.value || null })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-500">Freight account</span>
                    <input
                      type="text"
                      value={draft.schedulingLogistics?.freightAccount ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({
                          freightAccount: e.target.value || null,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-500">Carrier account</span>
                    <input
                      type="text"
                      value={draft.schedulingLogistics?.carrierAccount ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({
                          carrierAccount: e.target.value || null,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="text-slate-500">Billing address</span>
                    <input
                      type="text"
                      value={draft.schedulingLogistics?.billingAddress ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({
                          billingAddress: e.target.value || null,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="text-slate-500">Delivery address</span>
                    <input
                      type="text"
                      value={draft.schedulingLogistics?.deliveryAddress ?? ""}
                      onChange={(e) =>
                        patchSchedulingLogistics({
                          deliveryAddress: e.target.value || null,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                </div>
              ) : (
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {(
                    [
                      ["Logistics status", display.schedulingLogistics?.jobStatus],
                      ["Shipment method", display.schedulingLogistics?.shipmentMethod],
                      ["Ship date", display.schedulingLogistics?.shipDate],
                      [
                        "Responsible person",
                        display.schedulingLogistics?.responsiblePersonId ?? null,
                      ],
                      ["Accountable", display.schedulingLogistics?.accountable],
                      ["Freight account", display.schedulingLogistics?.freightAccount],
                      ["Carrier account", display.schedulingLogistics?.carrierAccount],
                      ["Billing address", display.schedulingLogistics?.billingAddress],
                      ["Delivery address", display.schedulingLogistics?.deliveryAddress],
                    ] as [string, string | number | null | undefined][]
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right text-slate-700">
                        {value === null || value === undefined || value === ""
                          ? "—"
                          : value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <QaTraceabilitySection jobId={display.id} />

            {isManager && (
              <ActivityAuditTrail
                jobId={display.dbId ?? ""}
                refreshKey={auditRefreshKey}
              />
            )}
          </div>

          </div>

        </article>
      </div>
    </main>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[5.5rem] min-w-0 flex-col rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        <Lock className="h-3 w-3 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-2 flex-1 break-words text-sm font-semibold leading-snug text-slate-900">
        {value}
      </p>
    </div>
  );
}

function FieldBlock({
  label,
  icon: Icon,
  children,
  isEditing,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  isEditing?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 print:border-slate-300 print:p-2">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
        {isEditing && (
          <span className="normal-case text-blue-600">(editable)</span>
        )}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function YesNoField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 transition-colors ${
        checked
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-slate-50"
      } ${disabled ? "cursor-default opacity-90" : "hover:border-slate-300"}`}
    >
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-base font-bold text-slate-900">
          {checked ? "Yes" : "No"}
        </span>
      </span>
    </label>
  );
}
