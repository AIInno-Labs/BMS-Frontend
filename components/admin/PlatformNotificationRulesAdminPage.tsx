"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { JobEmailRulesEditor } from "@/components/notifications/JobEmailRulesEditor";
import { useAuth } from "@/context/AuthContext";
import {
  listJobEmailRecipients,
  listOrganizations,
  listUsers,
  updateJobEmailRecipients,
} from "@/lib/frp/api";
import type {
  JobEmailRecipientCategory,
  JobEmailRecipientDTO,
  OrganizationDTO,
  UserDTO,
} from "@/lib/frp/types";

const inputClass =
  "mt-1.5 w-full min-h-[42px] rounded-[14px] border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#0F172A] shadow-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

const SECTIONS: {
  id: string;
  label: string;
  categories: JobEmailRecipientCategory[];
}[] = [
  { id: "JOB_LIFECYCLE", label: "Job Lifecycle", categories: ["JOB_LIFECYCLE"] },
  {
    id: "DOCUMENTS",
    label: "Documents & Approvals",
    categories: ["DOCUMENTS", "APPROVALS"],
  },
  { id: "FINANCE", label: "Finance", categories: ["FINANCE"] },
];

const OPERATION_MILESTONE: Record<string, string> = {
  SCOPE: "DESIGN",
  CAD: "DESIGN",
  REV: "DESIGN",
  CLIENT_APPROVAL: "APPROVAL",
  ENGINEER_APPROVAL: "APPROVAL",
  MOULD: "PRODUCTION",
  LAYUP: "PRODUCTION",
  CURE: "PRODUCTION",
  VISUAL: "QC",
  DIMENSIONAL: "QC",
  SIGNOFF: "QC",
};

const MILESTONE_ORDER = [
  "DRAFT",
  "DESIGN",
  "APPROVAL",
  "PRODUCTION",
  "QC",
  "DISPATCH",
  "COMPLETED",
] as const;

const MILESTONE_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  DESIGN: "Drawing",
  APPROVAL: "Approval",
  PRODUCTION: "Production",
  QC: "QC",
  DISPATCH: "Dispatch",
  COMPLETED: "Completed",
};

const OPERATION_ORDER: Record<string, string[]> = {
  DESIGN: ["SCOPE", "CAD", "REV"],
  APPROVAL: ["CLIENT_APPROVAL", "ENGINEER_APPROVAL"],
  PRODUCTION: ["MOULD", "LAYUP", "CURE"],
  QC: ["VISUAL", "DIMENSIONAL", "SIGNOFF"],
};

/** Uploads first, then drawing/PO review. Keys are eventKey:event. */
const DOCUMENT_EVENT_ORDER = [
  "DRAWING:UPLOADED",
  "PO:UPLOADED",
  "REVISION:UPLOADED",
  "APPROVAL:APPROVED",
  "APPROVAL:REJECTED",
];

function rowKey(row: JobEmailRecipientDTO): string {
  const def = row.eventDef;
  if (!def?.eventKey || !def.event) return String(row.id ?? "");
  return `${def.eventKey}:${def.event}`;
}

function eventKeyOf(row: JobEmailRecipientDTO): string {
  return row.eventDef?.eventKey ?? "";
}

function sortDocumentEvents(events: JobEmailRecipientDTO[]): JobEmailRecipientDTO[] {
  return [...events].sort((a, b) => {
    const ai = DOCUMENT_EVENT_ORDER.indexOf(rowKey(a));
    const bi = DOCUMENT_EVENT_ORDER.indexOf(rowKey(b));
    return (ai === -1 ? DOCUMENT_EVENT_ORDER.length : ai) -
      (bi === -1 ? DOCUMENT_EVENT_ORDER.length : bi);
  });
}

function operationOrder(milestoneKey: string, eventKey: string): number {
  const order = OPERATION_ORDER[milestoneKey];
  if (!order) return 0;
  const idx = order.indexOf(eventKey);
  return idx === -1 ? order.length : idx;
}

function flattenEvents(
  events: JobEmailRecipientDTO[],
  nestMilestones: boolean
): { row: JobEmailRecipientDTO; indent: boolean }[] {
  if (!nestMilestones) {
    return events.map((row) => ({ row, indent: false }));
  }
  const unused = new Set(events);
  const byKey = new Map<string, JobEmailRecipientDTO[]>();
  for (const row of events) {
    const key = eventKeyOf(row);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  const out: { row: JobEmailRecipientDTO; indent: boolean }[] = [];
  for (const row of events) {
    if (eventKeyOf(row) === "JOB") {
      unused.delete(row);
      out.push({ row, indent: false });
    }
  }
  for (const milestoneKey of MILESTONE_ORDER) {
    const milestone = (byKey.get(milestoneKey) ?? [])[0] ?? null;
    const operations = events
      .filter((row) => OPERATION_MILESTONE[eventKeyOf(row)] === milestoneKey)
      .sort(
        (a, b) =>
          operationOrder(milestoneKey, eventKeyOf(a)) -
          operationOrder(milestoneKey, eventKeyOf(b))
      );
    if (!milestone && operations.length === 0) continue;
    if (milestone) unused.delete(milestone);
    for (const op of operations) unused.delete(op);
    if (milestone) out.push({ row: milestone, indent: false });
    for (const op of operations) out.push({ row: op, indent: true });
  }
  for (const row of events) {
    if (unused.has(row)) out.push({ row, indent: false });
  }
  return out;
}

function defaultsPayload(row: JobEmailRecipientDTO): JobEmailRecipientDTO {
  return {
    eventDef: row.eventDef
      ? {
          category: row.eventDef.category,
          eventKey: row.eventDef.eventKey,
          event: row.eventDef.event,
          documentAttachmentRequired:
            row.eventDef.documentAttachmentRequired === 1
              ? 1
              : row.eventDef.documentAttachmentRequired === 0
                ? 0
                : -1,
        }
      : undefined,
    enabled: row.enabled !== false,
    orgEditable: row.orgEditable !== false,
    assigningTrigger: Boolean(row.assigningTrigger),
    customerTriggered: Boolean(row.customerTriggered),
  };
}

/** Catalog marks attachment applicable when value is not -1. */
function supportsDocumentAttachmentToggle(row: JobEmailRecipientDTO): boolean {
  return (row.eventDef?.documentAttachmentRequired ?? -1) !== -1;
}

type PlatformPatch = Pick<
  JobEmailRecipientDTO,
  "enabled" | "orgEditable" | "assigningTrigger" | "customerTriggered"
> & {
  documentAttachmentRequired?: number;
};

function platformPayload(
  row: JobEmailRecipientDTO,
  patch: PlatformPatch
): JobEmailRecipientDTO {
  const base = defaultsPayload(row);
  const attachment =
    patch.documentAttachmentRequired ??
    (row.eventDef?.documentAttachmentRequired === 1
      ? 1
      : row.eventDef?.documentAttachmentRequired === 0
        ? 0
        : -1);
  return {
    ...base,
    enabled: patch.enabled ?? base.enabled,
    orgEditable: patch.orgEditable ?? base.orgEditable,
    assigningTrigger: patch.assigningTrigger ?? base.assigningTrigger,
    customerTriggered: patch.customerTriggered ?? base.customerTriggered,
    eventDef: base.eventDef
      ? { ...base.eventDef, documentAttachmentRequired: attachment }
      : undefined,
  };
}

export function PlatformNotificationRulesAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOrg = searchParams.get("organizationId");

  const [scope, setScope] = useState<"platform" | "org">(
    initialOrg ? "org" : "platform"
  );
  const [orgId, setOrgId] = useState<number | "">(
    initialOrg && !Number.isNaN(Number(initialOrg)) ? Number(initialOrg) : ""
  );
  const [orgs, setOrgs] = useState<OrganizationDTO[]>([]);
  const [rows, setRows] = useState<JobEmailRecipientDTO[]>([]);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const orgScope = scope === "org";
  const selectedOrgId = orgScope && orgId !== "" ? Number(orgId) : null;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "superadmin") {
      router.replace(appRole === "orgadmin" ? "/org" : "/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  const lastOrgsLoadedForRoleRef = useRef<string | null>(null);
  useEffect(() => {
    if (appRole !== "superadmin") return;
    if (lastOrgsLoadedForRoleRef.current === appRole) return;
    lastOrgsLoadedForRoleRef.current = appRole;
    void (async () => {
      try {
        const res = await listOrganizations(0, 100);
        setOrgs(res.content ?? []);
      } catch {
        setOrgs([]);
      }
    })();
  }, [appRole]);

  const load = useCallback(async () => {
    if (appRole !== "superadmin") return;
    if (orgScope && orgId === "") {
      setRows([]);
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setUsersError(null);
    try {
      if (selectedOrgId != null) {
        const catalog = await listJobEmailRecipients(selectedOrgId);
        setRows(catalog.filter((row) => row.eventDef != null));
        try {
          const page = await listUsers(0, 200, selectedOrgId);
          setUsers((page.content ?? []).filter((u) => u.enabled !== false));
          setUsersError(null);
        } catch (e) {
          setUsers([]);
          setUsersError(
            e instanceof Error ? e.message : "Could not load organization users"
          );
        }
      } else {
        const catalog = await listJobEmailRecipients();
        setRows(catalog.filter((row) => row.eventDef != null));
        setUsers([]);
      }
    } catch (e) {
      setRows([]);
      setUsers([]);
      setError(
        e instanceof Error ? e.message : "Could not load notification catalog"
      );
    } finally {
      setLoading(false);
    }
  }, [appRole, orgScope, orgId, selectedOrgId]);

  const lastLoadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${appRole}:${scope}:${orgId}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;
    void load();
  }, [appRole, scope, orgId, load]);

  const grouped = useMemo(() => {
    const byCategory = new Map<JobEmailRecipientCategory, JobEmailRecipientDTO[]>();
    for (const row of rows) {
      const category = row.eventDef?.category;
      if (!category) continue;
      const list = byCategory.get(category) ?? [];
      list.push(row);
      byCategory.set(category, list);
    }
    return SECTIONS.map((section) => {
      const events = section.categories.flatMap(
        (category) => byCategory.get(category) ?? []
      );
      return {
        id: section.id,
        label: section.label,
        events:
          section.id === "DOCUMENTS" ? sortDocumentEvents(events) : events,
      };
    }).filter((section) => section.events.length > 0);
  }, [rows]);

  async function patchRow(row: JobEmailRecipientDTO, patch: PlatformPatch) {
    const key = rowKey(row);
    setSavingKey(key);
    setError(null);
    try {
      const next = await updateJobEmailRecipients([platformPayload(row, patch)]);
      setRows(next.filter((item) => item.eventDef != null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save defaults");
    } finally {
      setSavingKey(null);
    }
  }

  if (authLoading || !isAuthenticated || appRole !== "superadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Super Admin
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">
              Notifications
            </h2>
            <p className="mt-1 text-sm text-slate-600 sm:hidden">
              Platform defaults, or pick an organization. Org editable controls
              whether Org Admins can override an event.
            </p>
            <p className="mt-1 hidden text-sm text-slate-600 sm:block">
              Platform scope disables an event for every organization, sets
              Assigned Worker and Customer Contact defaults, and whether Org
              Admins may override each event. Organization scope uses the same
              recipient editor as Org Admin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto sm:min-h-[40px]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="app-card mt-6 !p-4 sm:!p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <div className="w-full sm:w-auto">
              <label className={labelClass} htmlFor="scope">
                Scope
              </label>
              <select
                id="scope"
                className={inputClass}
                value={scope}
                onChange={(e) => {
                  const v = e.target.value as "platform" | "org";
                  setScope(v);
                  if (v === "platform") setOrgId("");
                }}
              >
                <option value="platform">Platform (catalog)</option>
                <option value="org">Organization</option>
              </select>
            </div>
            {orgScope && (
              <div className="w-full min-w-0 sm:min-w-[240px] sm:flex-1">
                <label className={labelClass} htmlFor="org">
                  Organization
                </label>
                <select
                  id="org"
                  className={inputClass}
                  value={orgId === "" ? "" : String(orgId)}
                  onChange={(e) =>
                    setOrgId(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Select organization…</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.companyName} ({o.companyCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {!orgScope && error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading notification events…</p>
        ) : orgScope && orgId === "" ? (
          <p className="mt-4 text-sm text-slate-600">Select an organization.</p>
        ) : orgScope ? (
          <div className="mt-6">
            <JobEmailRulesEditor
              rows={rows}
              users={users}
              usersLoading={loading}
              usersError={usersError}
              rowsLoading={false}
              rowsError={error}
              onSave={async (payload) => {
                const next = await updateJobEmailRecipients(
                  [payload],
                  selectedOrgId
                );
                setRows(next.filter((row) => row.eventDef != null));
                return next;
              }}
            />
          </div>
        ) : grouped.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No notification events are available.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {grouped.map((section) => (
              <section
                key={section.id}
                className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
              >
                <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {section.label}
                  </h3>
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col />
                      <col className="w-24" />
                      <col className="w-28" />
                    </colgroup>
                    <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Event</th>
                        <th className="w-24 px-4 py-2.5">Enabled</th>
                        <th className="w-28 px-4 py-2.5">Org editable</th>
                        <th className="px-4 py-2.5">Assigned worker</th>
                        <th className="px-4 py-2.5">Customer contact</th>
                        <th className="w-40 px-4 py-2.5">Email attachment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flattenEvents(
                        section.events,
                        section.id === "JOB_LIFECYCLE"
                      ).map(({ row, indent }, idx) => (
                        <DefaultRow
                          key={rowKey(row)}
                          row={row}
                          indent={indent}
                          striped={idx % 2 === 1}
                          saving={savingKey === rowKey(row)}
                          onPatch={patchRow}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-slate-100 md:hidden">
                  {flattenEvents(
                    section.events,
                    section.id === "JOB_LIFECYCLE"
                  ).map(({ row, indent }) => (
                    <DefaultCard
                      key={rowKey(row)}
                      row={row}
                      indent={indent}
                      saving={savingKey === rowKey(row)}
                      onPatch={patchRow}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DefaultRow({
  row,
  indent,
  striped,
  saving,
  onPatch,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
  striped: boolean;
  saving: boolean;
  onPatch: (row: JobEmailRecipientDTO, patch: PlatformPatch) => void;
}) {
  return (
    <tr
      className={`border-t border-slate-100 ${
        striped ? "bg-[#FAFBFC]" : "bg-white"
      } ${row.enabled === false ? "opacity-60" : ""}`}
    >
      <td className="px-4 py-3">
        <EventName row={row} indent={indent} />
      </td>
      <td className="w-24 px-4 py-3 align-middle">
        <Flag
          label="Enabled"
          checked={row.enabled !== false}
          disabled={saving}
          onChange={(enabled) => onPatch(row, { enabled })}
        />
      </td>
      <td className="w-28 px-4 py-3 align-middle">
        <Flag
          label="Org editable"
          checked={row.orgEditable !== false}
          disabled={saving}
          onChange={(orgEditable) => onPatch(row, { orgEditable })}
        />
      </td>
      <td className="px-4 py-3">
        <Flag
          label="Assigned worker"
          checked={Boolean(row.assigningTrigger)}
          disabled={saving || row.enabled === false}
          onChange={(assigningTrigger) => onPatch(row, { assigningTrigger })}
        />
      </td>
      <td className="px-4 py-3">
        <Flag
          label="Customer contact"
          checked={Boolean(row.customerTriggered)}
          disabled={saving || row.enabled === false}
          onChange={(customerTriggered) => onPatch(row, { customerTriggered })}
        />
      </td>
      <td className="w-40 px-4 py-3 align-middle">
        {supportsDocumentAttachmentToggle(row) ? (
          <Flag
            label="Email attachment"
            checked={row.eventDef?.documentAttachmentRequired === 1}
            disabled={saving || row.enabled === false}
            onChange={(on) =>
              onPatch(row, { documentAttachmentRequired: on ? 1 : 0 })
            }
          />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

function DefaultCard({
  row,
  indent,
  saving,
  onPatch,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
  saving: boolean;
  onPatch: (row: JobEmailRecipientDTO, patch: PlatformPatch) => void;
}) {
  return (
    <article
      className={`px-4 py-3 ${
        indent ? "border-l-[3px] border-slate-200 bg-[#FAFBFC]" : ""
      } ${row.enabled === false ? "opacity-60" : ""}`}
    >
      <EventName row={row} indent={indent} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Flag
          label="Enabled"
          compact
          checked={row.enabled !== false}
          disabled={saving}
          onChange={(enabled) => onPatch(row, { enabled })}
        />
        <Flag
          label="Org editable"
          compact
          checked={row.orgEditable !== false}
          disabled={saving}
          onChange={(orgEditable) => onPatch(row, { orgEditable })}
        />
        <Flag
          label="Assigned"
          compact
          checked={Boolean(row.assigningTrigger)}
          disabled={saving || row.enabled === false}
          onChange={(assigningTrigger) => onPatch(row, { assigningTrigger })}
        />
        <Flag
          label="Customer"
          compact
          checked={Boolean(row.customerTriggered)}
          disabled={saving || row.enabled === false}
          onChange={(customerTriggered) => onPatch(row, { customerTriggered })}
        />
      </div>
      {supportsDocumentAttachmentToggle(row) ? (
        <div className="mt-3">
          <Flag
            label="Email attachment"
            compact
            checked={row.eventDef?.documentAttachmentRequired === 1}
            disabled={saving || row.enabled === false}
            onChange={(on) =>
              onPatch(row, { documentAttachmentRequired: on ? 1 : 0 })
            }
          />
        </div>
      ) : null}
    </article>
  );
}

function EventName({
  row,
  indent,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
}) {
  const name = row.eventDef?.eventName ?? rowKey(row);
  const parent = OPERATION_MILESTONE[row.eventDef?.eventKey ?? ""];
  const milestone = indent && parent ? (MILESTONE_LABEL[parent] ?? parent) : null;
  return (
    <>
      {milestone ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {milestone}
        </p>
      ) : null}
      <p className={`font-semibold text-slate-900 ${indent ? "pl-3" : ""}`}>
        {name}
      </p>
      <p className={`line-clamp-2 text-xs text-slate-500 ${indent ? "pl-3" : ""}`}>
        {row.eventDef?.description ?? ""}
      </p>
    </>
  );
}

function Flag({
  label,
  checked,
  disabled,
  onChange,
  compact = false,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <label className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-2 text-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </label>
    );
  }
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="md:sr-only">{label}</span>
    </label>
  );
}
