"use client";

import {
  CircleDashed,
  CloudOff,
  FileCheck2,
  FolderTree,
  Receipt,
} from "lucide-react";
import type { Job } from "@/lib/types";

/**
 * Single Job View panels for the three subsystems that hang off a Job:
 * purchase orders (DEL-03), drawings and approvals (DEL-05), and SharePoint
 * document storage (DEL-04).
 *
 * The structure is rendered now so the Single Job View is complete for DEL-01;
 * each panel takes its data as props and shows a genuine empty state until the
 * owning deliverable supplies it. Wire real data by passing the props — no
 * layout changes required.
 */

export interface JobPurchaseOrder {
  /** Client PO number as printed on the document. */
  poNumber: string;
  /** 1-based amendment version — v1, v2, v3 (PRD §2.3). */
  version: number;
  issuedOn?: string | null;
  /** Field-level discrepancies against the accepted quote. */
  varianceCount?: number;
}

export type DrawingStage =
  | "Site Visit"
  | "Drafting"
  | "Revisions"
  | "Engineering Approval";

/** Sequential drawing lifecycle, PRD §3.1. */
export const DRAWING_STAGES: DrawingStage[] = [
  "Site Visit",
  "Drafting",
  "Revisions",
  "Engineering Approval",
];

export type SharePointSyncStatus =
  | "success"
  | "pending"
  | "failed"
  | "not-configured";

const SYNC_META: Record<
  SharePointSyncStatus,
  { label: string; className: string }
> = {
  success: {
    label: "Synced",
    className: "border-[#86EFAC] bg-[#DCFCE7] text-[#166534]",
  },
  pending: {
    label: "Pending",
    className: "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]",
  },
  failed: {
    label: "Failed",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  "not-configured": {
    label: "Not connected",
    className: "border-[#E2E8F0] bg-[#F8FAFC] text-slate-500",
  },
};

function PanelShell({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Receipt;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
          <Icon className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-3 py-4 text-center text-xs text-slate-500">
      {children}
    </p>
  );
}

export function PurchaseOrdersPanel({
  purchaseOrders,
}: {
  purchaseOrders: JobPurchaseOrder[];
}) {
  const totalVariances = purchaseOrders.reduce(
    (sum, po) => sum + (po.varianceCount ?? 0),
    0
  );

  return (
    <PanelShell
      title="Purchase Orders"
      icon={Receipt}
      action={
        totalVariances > 0 ? (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            {totalVariances} variance{totalVariances === 1 ? "" : "s"}
          </span>
        ) : null
      }
    >
      {purchaseOrders.length === 0 ? (
        <EmptyState>No purchase orders linked to this job.</EmptyState>
      ) : (
        <ul className="mt-3 space-y-2">
          {purchaseOrders.map((po) => (
            <li
              key={`${po.poNumber}-v${po.version}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#0F172A]">
                  {po.poNumber}
                </p>
                {po.issuedOn && (
                  <p className="text-[11px] text-slate-500">
                    Issued {po.issuedOn}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {(po.varianceCount ?? 0) > 0 && (
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    {po.varianceCount}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                  v{po.version}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function DrawingsApprovalsPanel({
  currentStage,
  clientRevisionApprovals,
}: {
  currentStage: DrawingStage | null;
  /** Revision labels with recorded client sign-off, e.g. ["Revision A"]. */
  clientRevisionApprovals: string[];
}) {
  const currentIndex = currentStage ? DRAWING_STAGES.indexOf(currentStage) : -1;

  return (
    <PanelShell title="Drawings & Approvals" icon={FileCheck2}>
      {currentIndex === -1 ? (
        <EmptyState>Drawing workflow has not started for this job.</EmptyState>
      ) : (
        <ol className="mt-3 space-y-2">
          {DRAWING_STAGES.map((stage, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <li key={stage} className="flex items-center gap-2.5">
                {done ? (
                  <FileCheck2
                    className="h-4 w-4 shrink-0 text-[#166534]"
                    aria-hidden
                  />
                ) : (
                  <CircleDashed
                    className={`h-4 w-4 shrink-0 ${
                      active ? "text-[#2563EB]" : "text-slate-300"
                    }`}
                    aria-hidden
                  />
                )}
                <span
                  className={`text-sm ${
                    active
                      ? "font-semibold text-[#0F172A]"
                      : done
                        ? "text-slate-600"
                        : "text-slate-400"
                  }`}
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 border-t border-[#E2E8F0] pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Client approvals
        </p>
        {clientRevisionApprovals.length === 0 ? (
          <p className="mt-1.5 text-xs text-slate-500">
            No client revision approvals recorded.
          </p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {clientRevisionApprovals.map((revision) => (
              <span
                key={revision}
                className="inline-flex items-center rounded-full border border-[#86EFAC] bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-semibold text-[#166534]"
              >
                {revision}
              </span>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function SharePointFilesPanel({
  syncStatus,
  folderPath,
  subfolders,
}: {
  syncStatus: SharePointSyncStatus;
  /** Provisioned root, `[job_name]-[job_id]` (PRD §2.4). */
  folderPath: string | null;
  subfolders: string[];
}) {
  const meta = SYNC_META[syncStatus];

  return (
    <PanelShell
      title="SharePoint"
      icon={FolderTree}
      action={
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
        >
          {meta.label}
        </span>
      }
    >
      {syncStatus === "not-configured" || !folderPath ? (
        <div className="mt-3 flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-3 py-4 text-center">
          <CloudOff className="h-4 w-4 text-slate-400" aria-hidden />
          <p className="text-xs text-slate-500">
            No SharePoint folder provisioned for this job.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="truncate font-mono text-[11px] text-slate-600">
            {folderPath}
          </p>
          <ul className="mt-2 space-y-1">
            {subfolders.map((folder) => (
              <li
                key={folder}
                className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5"
              >
                <FolderTree
                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  aria-hidden
                />
                <span className="font-mono text-[11px] text-slate-600">
                  /{folder}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelShell>
  );
}

/**
 * Reads what already exists on the Job today. The job card print details carry
 * a client PO number, so a single v1 entry is shown when present; full version
 * history arrives with the PO tracker in DEL-03.
 */
function derivePurchaseOrders(job: Job): JobPurchaseOrder[] {
  const poNumber = job.printDetails?.purchaseOrderNo?.trim();
  if (!poNumber) return [];
  return [{ poNumber, version: 1 }];
}

export function JobJourneyPanels({ job }: { job: Job }) {
  return (
    <>
      <PurchaseOrdersPanel purchaseOrders={derivePurchaseOrders(job)} />
      <DrawingsApprovalsPanel currentStage={null} clientRevisionApprovals={[]} />
      <SharePointFilesPanel
        syncStatus="not-configured"
        folderPath={null}
        subfolders={["Drawings", "Photos", "POs"]}
      />
    </>
  );
}
