"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Search, X } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import type {
  JobEmailRecipientCategory,
  JobEmailRecipientDTO,
  UserDTO,
} from "@/lib/frp/types";

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

const CUSTOMER_CONTACT = "CUSTOMER_CONTACT";
const ASSIGNED_WORKER = "ASSIGNED_WORKER";

const SPECIAL_RECIPIENTS: { id: string; label: string }[] = [
  { id: CUSTOMER_CONTACT, label: "Customer Contact" },
  { id: ASSIGNED_WORKER, label: "Assigned Worker" },
];

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

function milestoneLabelFor(eventKey: string): string | null {
  const parent = OPERATION_MILESTONE[eventKey];
  return parent ? (MILESTONE_LABEL[parent] ?? parent) : null;
}

function eventTitle(row: JobEmailRecipientDTO): string {
  const name = row.eventDef?.eventName ?? rowKey(row);
  const milestone = milestoneLabelFor(row.eventDef?.eventKey ?? "");
  return milestone ? `${milestone} · ${name}` : name;
}

/** Catalog marks attachment applicable when value is not -1. */
function supportsDocumentAttachmentToggle(row: JobEmailRecipientDTO): boolean {
  const platform = row.platformDocumentAttachmentRequired;
  if (platform != null) {
    return platform !== -1;
  }
  return (row.eventDef?.documentAttachmentRequired ?? -1) !== -1;
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
  enabled: boolean,
  documentAttachmentRequired?: number
): JobEmailRecipientDTO {
  const userIds = selected.filter((id): id is number => typeof id === "number");
  const attachment =
    documentAttachmentRequired ??
    (row.eventDef?.documentAttachmentRequired === 1
      ? 1
      : row.eventDef?.documentAttachmentRequired === 0
        ? 0
        : -1);
  return {
    ...(row.id != null ? { id: row.id } : {}),
    eventDef: row.eventDef
      ? {
          category: row.eventDef.category,
          eventKey: row.eventDef.eventKey,
          event: row.eventDef.event,
          documentAttachmentRequired: attachment,
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

export function JobEmailRulesEditor({
  rows,
  users,
  usersLoading,
  usersError,
  rowsLoading,
  rowsError,
  onSave,
}: {
  rows: JobEmailRecipientDTO[];
  users: UserDTO[];
  usersLoading: boolean;
  usersError: string | null;
  rowsLoading: boolean;
  rowsError: string | null;
  onSave: (payload: JobEmailRecipientDTO) => Promise<JobEmailRecipientDTO[]>;
}) {
  const [drawerRow, setDrawerRow] = useState<JobEmailRecipientDTO | null>(null);
  const [drawerSelected, setDrawerSelected] = useState<(number | string)[]>([]);
  const [drawerEnabled, setDrawerEnabled] = useState(true);
  const [drawerDocumentAttachment, setDrawerDocumentAttachment] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

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

  function openEdit(row: JobEmailRecipientDTO) {
    setDrawerRow(row);
    setDrawerSelected(selectedFromRow(row));
    setDrawerEnabled(row.enabled !== false);
    setDrawerDocumentAttachment(row.eventDef?.documentAttachmentRequired === 1);
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

  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setDropdownRect(null);
      return;
    }
    function updateRect() {
      const el = searchInputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [userSearchQuery, drawerRow]);

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
      await onSave(
        payloadFromSelection(
          drawerRow,
          drawerSelected,
          drawerEnabled,
          supportsDocumentAttachmentToggle(drawerRow)
            ? drawerDocumentAttachment
              ? 1
              : 0
            : (drawerRow.eventDef?.documentAttachmentRequired ?? -1)
        )
      );
      setDrawerRow(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save recipients");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(row: JobEmailRecipientDTO, enabled: boolean) {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(payloadFromSelection(row, selectedFromRow(row), enabled));
      if (drawerRow && rowKey(drawerRow) === rowKey(row)) {
        setDrawerEnabled(enabled);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not update enabled");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
              saving={saving}
              onEdit={openEdit}
              onToggleEnabled={toggleEnabled}
            />
          ))}
        </div>
      )}

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
          {drawerRow && supportsDocumentAttachmentToggle(drawerRow) ? (
            <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={drawerDocumentAttachment}
                onChange={(e) => setDrawerDocumentAttachment(e.target.checked)}
                className="h-4 w-4"
              />
              Attach stage documents to email
            </label>
          ) : null}
          {drawerRow && supportsDocumentAttachmentToggle(drawerRow) ? (
            <p className="mt-1 text-xs font-normal text-slate-500">
              When on, operators can choose to attach stage documents on status
              complete. Only org admins can change this.
            </p>
          ) : null}
          <div className="mt-2 max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
            <div className="space-y-1.5 border-b border-slate-100 pb-3">
              {SPECIAL_RECIPIENTS.map((r) => (
                <label
                  key={r.id}
                  className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={drawerSelected.includes(r.id)}
                    onChange={() => toggleRecipient(r.id)}
                    className="h-4 w-4"
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
                  ref={searchInputRef}
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by name or email to add…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                {userSearchQuery.trim() && dropdownRect
                  ? createPortal(
                      <div
                        className="fixed z-[110] max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                        style={{
                          top: dropdownRect.top,
                          left: dropdownRect.left,
                          width: dropdownRect.width,
                        }}
                      >
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
                      </div>,
                      document.body
                    )
                  : null}
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
    </>
  );
}

function RecipientCount({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-xs text-slate-400">0</span>;
  }
  return <span className="text-sm font-semibold text-slate-700">{count}</span>;
}

function CategorySection({
  label,
  events,
  nestMilestones = false,
  saving,
  onEdit,
  onToggleEnabled,
}: {
  label: string;
  events: JobEmailRecipientDTO[];
  nestMilestones?: boolean;
  saving: boolean;
  onEdit: (row: JobEmailRecipientDTO) => void;
  onToggleEnabled: (row: JobEmailRecipientDTO, enabled: boolean) => void;
}) {
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
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col />
            <col className="w-24" />
          </colgroup>
          <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Event</th>
              <th className="w-24 px-4 py-2.5">Enabled</th>
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
                saving={saving}
                onEdit={onEdit}
                onToggleEnabled={onToggleEnabled}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {display.map(({ row, indent }) => (
          <EventCard
            key={rowKey(row)}
            row={row}
            indent={indent}
            saving={saving}
            onEdit={onEdit}
            onToggleEnabled={onToggleEnabled}
          />
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
      <p className={`line-clamp-2 text-xs text-slate-500 ${indent ? "pl-3" : ""}`}>
        {row.eventDef?.description ?? ""}
      </p>
    </>
  );
}

function EventTableRow({
  row,
  indent,
  striped,
  saving,
  onEdit,
  onToggleEnabled,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
  striped: boolean;
  saving: boolean;
  onEdit: (row: JobEmailRecipientDTO) => void;
  onToggleEnabled: (row: JobEmailRecipientDTO, enabled: boolean) => void;
}) {
  const count = row.totalRecipients ?? selectedFromRow(row).length;
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
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={row.enabled !== false}
            disabled={saving}
            onChange={(e) => onToggleEnabled(row, e.target.checked)}
          />
          <span className="md:sr-only">Enabled</span>
        </label>
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
  saving,
  onEdit,
  onToggleEnabled,
}: {
  row: JobEmailRecipientDTO;
  indent: boolean;
  saving: boolean;
  onEdit: (row: JobEmailRecipientDTO) => void;
  onToggleEnabled: (row: JobEmailRecipientDTO, enabled: boolean) => void;
}) {
  const count = row.totalRecipients ?? selectedFromRow(row).length;
  return (
    <article
      className={`px-4 py-3 ${
        indent ? "border-l-[3px] border-slate-200 bg-[#FAFBFC]" : ""
      } ${row.enabled === false ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <EventName row={row} indent={indent} />
        </div>
        <label className="flex min-h-11 min-w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2">
          <input
            type="checkbox"
            checked={row.enabled !== false}
            disabled={saving}
            onChange={(e) => onToggleEnabled(row, e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Enabled
          </span>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{count}</span>
          {count === 1 ? " recipient" : " recipients"}
        </p>
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-orange-50"
          onClick={() => onEdit(row)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </article>
  );
}
