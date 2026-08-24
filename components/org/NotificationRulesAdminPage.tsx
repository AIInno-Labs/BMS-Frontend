"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Search, X } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { useAuth } from "@/context/AuthContext";
import {
  listJobEmailRecipients,
  listUsers,
  updateJobEmailRecipients,
} from "@/lib/frp/api";
import type {
  JobEmailRecipientCategory,
  JobEmailRecipientDTO,
  UserDTO,
} from "@/lib/frp/types";

/** UI sections. Documents and drawing/PO approvals share one card. */
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

/** Operation eventKey → parent milestone eventKey. Matches JobStageServiceImpl. */
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

const CUSTOMER_CONTACT = "CUSTOMER_CONTACT";
const ASSIGNED_WORKER = "ASSIGNED_WORKER";

const SPECIAL_RECIPIENTS: { id: string; label: string }[] = [
  { id: CUSTOMER_CONTACT, label: "Customer Contact" },
  { id: ASSIGNED_WORKER, label: "Assigned Worker" },
];

function rowKey(row: JobEmailRecipientDTO): string {
  const def = row.eventDef;
  if (!def?.eventKey || !def.event) return String(row.id ?? "");
  return `${def.eventKey}:${def.event}`;
}

function eventKeyOf(row: JobEmailRecipientDTO): string {
  return row.eventDef?.eventKey ?? "";
}

function milestoneLabelFor(eventKey: string): string | null {
  const parent = OPERATION_MILESTONE[eventKey];
  return parent ? (MILESTONE_LABEL[parent] ?? parent) : null;
}

function eventTitle(row: JobEmailRecipientDTO): string {
  const name = row.eventDef?.eventName ?? rowKey(row);
  const milestone = milestoneLabelFor(row.eventDef?.eventKey ?? "");
  return milestone ? `${milestone} · ${name}` : name;
}

type LifecycleItem =
  | { kind: "row"; row: JobEmailRecipientDTO }
  | {
      kind: "group";
      key: string;
      label: string;
      milestone: JobEmailRecipientDTO | null;
      operations: JobEmailRecipientDTO[];
    };

function operationOrder(milestoneKey: string, eventKey: string): number {
  const order = OPERATION_ORDER[milestoneKey];
  if (!order) return 0;
  const idx = order.indexOf(eventKey);
  return idx === -1 ? order.length : idx;
}

const OPERATION_ORDER: Record<string, string[]> = {
  DESIGN: ["SCOPE", "CAD", "REV"],
  APPROVAL: ["CLIENT_APPROVAL", "ENGINEER_APPROVAL"],
  PRODUCTION: ["MOULD", "LAYUP", "CURE"],
  QC: ["VISUAL", "DIMENSIONAL", "SIGNOFF"],
};

function lifecycleItems(events: JobEmailRecipientDTO[]): LifecycleItem[] {
  const unused = new Set(events);
  const byKey = new Map<string, JobEmailRecipientDTO[]>();
  for (const row of events) {
    const key = eventKeyOf(row);
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const items: LifecycleItem[] = [];
  for (const row of events) {
    if (eventKeyOf(row) === "JOB") {
      unused.delete(row);
      items.push({ kind: "row", row });
    }
  }

  for (const milestoneKey of MILESTONE_ORDER) {
    const milestoneRows = byKey.get(milestoneKey) ?? [];
    const milestone = milestoneRows[0] ?? null;
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
    if (operations.length === 0 && milestone) {
      items.push({ kind: "row", row: milestone });
      continue;
    }
    items.push({
      kind: "group",
      key: milestoneKey,
      label: MILESTONE_LABEL[milestoneKey] ?? milestoneKey,
      milestone,
      operations,
    });
  }

  for (const row of events) {
    if (unused.has(row)) items.push({ kind: "row", row });
  }
  return items;
}

function parseUserIds(csv: string | null | undefined): number[] {
  if (!csv) return [];
  const ids: number[] = [];
  for (const part of csv.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) ids.push(n);
  }
  return ids;
}

function selectedFromRow(row: JobEmailRecipientDTO): (number | string)[] {
  const selected: (number | string)[] = [];
  if (row.customerTriggered) selected.push(CUSTOMER_CONTACT);
  if (row.assigningTrigger) selected.push(ASSIGNED_WORKER);
  selected.push(...parseUserIds(row.otherUserIds));
  return selected;
}

function payloadFromSelection(
  row: JobEmailRecipientDTO,
  selected: (number | string)[],
  enabled: boolean
): JobEmailRecipientDTO {
  const userIds = selected.filter((id): id is number => typeof id === "number");
  return {
    ...(row.id != null ? { id: row.id } : {}),
    eventDef: row.eventDef
      ? {
          category: row.eventDef.category,
          eventKey: row.eventDef.eventKey,
          event: row.eventDef.event,
        }
      : undefined,
    assigningTrigger: selected.includes(ASSIGNED_WORKER),
    customerTriggered: selected.includes(CUSTOMER_CONTACT),
    otherUserIds: userIds.join(","),
    customerSideRecipients: row.customerSideRecipients ?? "",
    clientSideRecipients: row.clientSideRecipients ?? "",
    enabled,
  };
}

export function NotificationRulesAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [rows, setRows] = useState<JobEmailRecipientDTO[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [drawerRow, setDrawerRow] = useState<JobEmailRecipientDTO | null>(null);
  const [drawerSelected, setDrawerSelected] = useState<(number | string)[]>([]);
  const [drawerEnabled, setDrawerEnabled] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (appRole !== "orgadmin") {
      router.replace(appRole === "superadmin" ? "/admin" : "/");
    }
  }, [authLoading, isAuthenticated, appRole, router]);

  const loadStartedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated || appRole !== "orgadmin") return;
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;

    async function load() {
      setUsersLoading(true);
      setRowsLoading(true);
      try {
        const [page, catalog] = await Promise.all([
          listUsers(0, 200),
          listJobEmailRecipients(),
        ]);
        setUsers((page.content ?? []).filter((u) => u.enabled !== false));
        setUsersError(null);
        setRows(catalog.filter((row) => row.eventDef != null));
        setRowsError(null);
      } catch (e) {
        setUsers([]);
        setRows([]);
        const message = e instanceof Error ? e.message : "Could not load notifications";
        setUsersError(message);
        setRowsError(message);
      } finally {
        setUsersLoading(false);
        setRowsLoading(false);
      }
    }
    void load();
  }, [authLoading, isAuthenticated, appRole]);

  const usersById = useMemo(() => {
    const map = new Map<number, UserDTO>();
    for (const u of users) {
      if (u.id != null) map.set(u.id, u);
    }
    return map;
  }, [users]);

  const grouped = useMemo(() => {
    const byCategory = new Map<JobEmailRecipientCategory, JobEmailRecipientDTO[]>();
    for (const row of rows) {
      const category = row.eventDef?.category;
      if (!category) continue;
      const list = byCategory.get(category) ?? [];
      list.push(row);
      byCategory.set(category, list);
    }
    return SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      events: section.categories.flatMap((category) => byCategory.get(category) ?? []),
    })).filter((section) => section.events.length > 0);
  }, [rows]);

  function openEdit(row: JobEmailRecipientDTO) {
    setDrawerRow(row);
    setDrawerSelected(selectedFromRow(row));
    setDrawerEnabled(row.enabled !== false);
    setUserSearchQuery("");
    setSaveError(null);
  }

  function closeDrawer() {
    if (saving) return;
    setDrawerRow(null);
    setSaveError(null);
  }

  function toggleRecipient(id: number | string) {
    setDrawerSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addUser(id: number) {
    setDrawerSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setUserSearchQuery("");
  }

  function removeRecipient(id: number | string) {
    setDrawerSelected((prev) => prev.filter((x) => x !== id));
  }

  const addedUsers = useMemo(() => {
    const ids = drawerSelected.filter((id): id is number => typeof id === "number");
    return ids
      .map((id) => usersById.get(id))
      .filter((u): u is UserDTO => u != null);
  }, [drawerSelected, usersById]);

  const userSearchResults = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const addedIds = new Set(addedUsers.map((u) => u.id));
    return users
      .filter((u) => u.id != null && !addedIds.has(u.id))
      .filter(
        (u) =>
          (u.displayName ?? "").toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [users, userSearchQuery, addedUsers]);

  function userRoleLabel(u: UserDTO): string {
    if (u.roleCodes && u.roleCodes.length > 0) return u.roleCodes.join(", ");
    return u.designation ?? "—";
  }

  async function saveDrawer() {
    if (!drawerRow?.eventDef) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await updateJobEmailRecipients([
        payloadFromSelection(drawerRow, drawerSelected, drawerEnabled),
      ]);
      setRows(next.filter((row) => row.eventDef != null));
      setDrawerRow(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save recipients");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !isAuthenticated || appRole !== "orgadmin") {
    return (
      <main className="app-mesh-bg flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="app-mesh-bg flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Organization Admin
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#111827]">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose which team members — and, where appropriate, the customer
            contact or assigned worker — get emailed when a job reaches each
            event below.
          </p>
        </div>

        {rowsError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {rowsError}
          </p>
        ) : null}
        {usersError && usersError !== rowsError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {usersError}
          </p>
        ) : null}

        {rowsLoading ? (
          <p className="text-sm text-slate-600">Loading notification events…</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-slate-600">No notification events are available.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map((section) => (
              <CategorySection
                key={section.id}
                label={section.label}
                events={section.events}
                nestMilestones={section.id === "JOB_LIFECYCLE"}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </div>

      <EnterpriseDrawer
        open={drawerRow != null}
        onClose={closeDrawer}
        title={
          drawerRow
            ? `Recipients — ${eventTitle(drawerRow)}`
            : "Recipients"
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={closeDrawer}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void saveDrawer()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <fieldset>
          <legend className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Recipients
          </legend>
          {saveError ? (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={drawerEnabled}
              onChange={(e) => setDrawerEnabled(e.target.checked)}
            />
            Email this event
          </label>
          <div className="mt-2 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
            <div className="space-y-1.5 border-b border-slate-100 pb-3">
              {SPECIAL_RECIPIENTS.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 text-sm font-medium text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={drawerSelected.includes(r.id)}
                    onChange={() => toggleRecipient(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by name or email to add…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                {userSearchQuery.trim() && (
                  <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {usersLoading ? (
                      <p className="px-3 py-2 text-sm text-slate-500">
                        Loading users…
                      </p>
                    ) : userSearchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">
                        No matching users.
                      </p>
                    ) : (
                      userSearchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => addUser(u.id!)}
                        >
                          <span className="text-sm font-medium text-slate-800">
                            {u.displayName || u.email}
                          </span>
                          {u.email && u.displayName ? (
                            <span className="text-xs text-slate-500">
                              {u.email}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Added ({addedUsers.length})
                </p>
                {addedUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No team members added yet.
                  </p>
                ) : (
                  addedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {u.displayName || u.email}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {u.email ?? "—"} · {userRoleLabel(u)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                        onClick={() => removeRecipient(u.id!)}
                        aria-label={`Remove ${u.displayName || u.email}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </fieldset>
      </EnterpriseDrawer>
    </main>
  );
}

function RecipientCount({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-xs text-slate-400">0</span>;
  }
  return <span className="text-sm font-semibold text-slate-700">{count}</span>;
}

interface CategorySectionProps {
  label: string;
  events: JobEmailRecipientDTO[];
  nestMilestones?: boolean;
  onEdit: (row: JobEmailRecipientDTO) => void;
}

function CategorySection({
  label,
  events,
  nestMilestones = false,
  onEdit,
}: CategorySectionProps) {
  const display = nestMilestones
    ? flattenLifecycle(events)
    : events.map((row) => ({ row, indent: false }));

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </h3>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Event</th>
              <th className="px-4 py-2.5">Recipients</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {display.map(({ row, indent }, idx) => (
              <EventTableRow
                key={rowKey(row)}
                row={row}
                indent={indent}
                striped={idx % 2 === 1}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 p-3 md:hidden">
        {display.map(({ row, indent }) => (
          <EventCard key={rowKey(row)} row={row} indent={indent} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

function flattenLifecycle(
  events: JobEmailRecipientDTO[]
): { row: JobEmailRecipientDTO; indent: boolean }[] {
  const out: { row: JobEmailRecipientDTO; indent: boolean }[] = [];
  for (const item of lifecycleItems(events)) {
    if (item.kind === "row") {
      out.push({ row: item.row, indent: false });
      continue;
    }
    if (item.milestone) {
      out.push({ row: item.milestone, indent: false });
    }
    for (const op of item.operations) {
      out.push({ row: op, indent: true });
    }
  }
  return out;
}

function EventName({
  row,
  indent,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
}) {
  const name = row.eventDef?.eventName ?? rowKey(row);
  const milestone = indent ? milestoneLabelFor(row.eventDef?.eventKey ?? "") : null;
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
      <p className={`text-xs text-slate-500 ${indent ? "pl-3" : ""}`}>
        {row.eventDef?.description ?? ""}
        {row.enabled === false ? " · Off" : ""}
      </p>
    </>
  );
}

function EventTableRow({
  row,
  indent,
  striped,
  onEdit,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
  striped: boolean;
  onEdit: (row: JobEmailRecipientDTO) => void;
}) {
  const count = row.totalRecipients ?? selectedFromRow(row).length;
  return (
    <tr
      className={`border-t border-slate-100 ${
        striped ? "bg-[#FAFBFC]" : "bg-white"
      }`}
    >
      <td className="px-4 py-3">
        <EventName row={row} indent={indent} />
      </td>
      <td className="px-4 py-3">
        <RecipientCount count={count} />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-orange-50"
          onClick={() => onEdit(row)}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          Edit recipients
        </button>
      </td>
    </tr>
  );
}

function EventCard({
  row,
  indent,
  onEdit,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
  onEdit: (row: JobEmailRecipientDTO) => void;
}) {
  const count = row.totalRecipients ?? selectedFromRow(row).length;
  return (
    <article
      className={`rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm ${
        indent ? "ml-3" : ""
      }`}
    >
      <EventName row={row} indent={indent} />
      <div className="mt-3">
        <RecipientCount count={count} />
      </div>
      <button
        type="button"
        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50"
        onClick={() => onEdit(row)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit recipients
      </button>
    </article>
  );
}
