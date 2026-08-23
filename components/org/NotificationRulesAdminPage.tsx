"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { EnterpriseDrawer } from "@/components/EnterpriseDrawer";
import { useAuth } from "@/context/AuthContext";
import { listUsers } from "@/lib/frp/api";
import type { UserDTO } from "@/lib/frp/types";

type NotificationCategory =
  | "Job Lifecycle"
  | "Documents & Approvals"
  | "Financial"
  | "Quote Events";

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  category: NotificationCategory;
}

/**
 * Client-side only — the backend has no event taxonomy for this yet
 * (see NotificationType.java's own "deliberately not anticipated" note).
 * Deliberately a fixed, developer-maintained list, not admin-editable: each
 * row has to correspond to a real moment a future backend hook can detect —
 * an admin-typed custom event would look configured while never firing.
 *
 * Job-lifecycle rows match `JobAuditEvent` (backend) and the Job page's real
 * actions. Quote Events match the 6 real Quotient webhook events
 * (`QuotientEventCode.java`) — added ahead of time, using their exact
 * existing labels, for whenever quote-level notifications are wired up.
 */
const NOTIFICATION_EVENTS: NotificationEvent[] = [
  // Job Lifecycle
  {
    id: "JOB_CREATED",
    label: "Job Created",
    description: "A new job is raised, manually or from an accepted quote.",
    category: "Job Lifecycle",
  },
  {
    id: "WORKER_ASSIGNED",
    label: "Worker Assigned",
    description: "A worker is assigned to the job.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_DRAFT",
    label: "Stage reached: Draft",
    description: "Job enters the draft / pending stage.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_DRAWING",
    label: "Stage reached: Drawing",
    description: "Job moves into the drawing stage.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_APPROVAL",
    label: "Stage reached: Approval",
    description: "Job moves into the approval stage.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_PRODUCTION",
    label: "Stage reached: Production",
    description: "Job is released to the shop floor.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_QC",
    label: "Stage reached: QC",
    description: "Job enters quality control.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_DISPATCH",
    label: "Stage reached: Dispatch",
    description: "Job is ready for dispatch.",
    category: "Job Lifecycle",
  },
  {
    id: "STAGE_COMPLETED",
    label: "Stage reached: Completed",
    description: "Job is marked complete.",
    category: "Job Lifecycle",
  },
  {
    id: "SUBSTAGE_CHANGED",
    label: "Sub-stage Changed",
    description: "A finer sub-stage within the current stage changes.",
    category: "Job Lifecycle",
  },
  {
    id: "JOB_ON_HOLD",
    label: "Job On Hold",
    description: "The job is placed on hold.",
    category: "Job Lifecycle",
  },
  {
    id: "JOB_CANCELLED",
    label: "Job Cancelled",
    description: "The job is cancelled.",
    category: "Job Lifecycle",
  },

  // Documents & Approvals
  {
    id: "DRAWING_UPLOADED",
    label: "Drawing Uploaded",
    description: "A drawing document is uploaded to the job.",
    category: "Documents & Approvals",
  },
  {
    id: "PO_UPLOADED",
    label: "PO Uploaded",
    description: "A purchase order is uploaded or entered on the job.",
    category: "Documents & Approvals",
  },
  {
    id: "REVISION_UPLOADED",
    label: "New Revision Uploaded",
    description: "A revised drawing or PO replaces an earlier version.",
    category: "Documents & Approvals",
  },
  {
    id: "APPROVED",
    label: "Approved",
    description: "A drawing, PO, or requirement is approved.",
    category: "Documents & Approvals",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    description: "A drawing, PO, or requirement is rejected.",
    category: "Documents & Approvals",
  },

  // Financial
  {
    id: "PAYMENT_RECEIVED",
    label: "Payment Received",
    description: "Payment is marked received on the job.",
    category: "Financial",
  },

  // Quote Events (Quotient) — ahead of backend wiring, matching QuotientEventCode
  {
    id: "QUOTE_SENT",
    label: "Quote Sent",
    description: "A quote is sent to the customer.",
    category: "Quote Events",
  },
  {
    id: "CUSTOMER_VIEWED",
    label: "Customer Viewed",
    description: "The customer opens the quote.",
    category: "Quote Events",
  },
  {
    id: "CUSTOMER_QUESTION",
    label: "Customer Question",
    description: "The customer asks a question on the quote.",
    category: "Quote Events",
  },
  {
    id: "QUOTE_ACCEPTED",
    label: "Quote Accepted",
    description: "The customer accepts the quote.",
    category: "Quote Events",
  },
  {
    id: "QUOTE_DECLINED",
    label: "Quote Declined",
    description: "The customer declines the quote.",
    category: "Quote Events",
  },
  {
    id: "QUOTE_COMPLETED",
    label: "Quote Completed",
    description: "The quote's job work is completed.",
    category: "Quote Events",
  },
];

/** Category headers rendered in this fixed order, grouping NOTIFICATION_EVENTS. */
const CATEGORY_ORDER: NotificationCategory[] = [
  "Job Lifecycle",
  "Documents & Approvals",
  "Financial",
  "Quote Events",
];

/**
 * Pinned, non-user recipient options. Selectable per event rather than
 * always-on: not every event is customer-facing (e.g. PO Uploaded often
 * carries internal pricing), and the assigned worker doesn't exist yet for
 * early events like Job Created.
 */
const SPECIAL_RECIPIENTS: { id: string; label: string }[] = [
  { id: "CUSTOMER_CONTACT", label: "Customer Contact" },
  { id: "ASSIGNED_WORKER", label: "Assigned Worker" },
];
const SPECIAL_RECIPIENT_LABELS = new Map(
  SPECIAL_RECIPIENTS.map((r) => [r.id, r.label])
);

/** eventId -> selected recipient ids (either a UserDTO.id, or one of SPECIAL_RECIPIENTS' string ids). */
type NotificationRules = Record<string, (number | string)[]>;

function storageKey(organizationId: string | number): string {
  return `bmsman-notification-rules-${organizationId}`;
}

function readRules(organizationId: string | number): NotificationRules {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(organizationId));
    return raw ? (JSON.parse(raw) as NotificationRules) : {};
  } catch {
    return {};
  }
}

function writeRules(organizationId: string | number, rules: NotificationRules) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(organizationId), JSON.stringify(rules));
}

export function NotificationRulesAdminPage() {
  const { loading: authLoading, isAuthenticated, appRole, user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [rules, setRules] = useState<NotificationRules>({});
  const [drawerEvent, setDrawerEvent] = useState<NotificationEvent | null>(null);
  const [drawerSelected, setDrawerSelected] = useState<(number | string)[]>([]);

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

  const organizationId = user?.organization?.id;

  useEffect(() => {
    if (authLoading || !isAuthenticated || appRole !== "orgadmin") return;
    if (organizationId == null) return;
    setRules(readRules(organizationId));
  }, [authLoading, isAuthenticated, appRole, organizationId]);

  // Guarded by a ref, not just the empty dep array: React Strict Mode (dev
  // only) mounts every component twice, and without this the initial load
  // fires the users GET twice on every page load (same fix as JobsContext).
  const usersLoadStartedRef = useRef(false);
  useEffect(() => {
    if (authLoading || !isAuthenticated || appRole !== "orgadmin") return;
    if (usersLoadStartedRef.current) return;
    usersLoadStartedRef.current = true;
    let cancelled = false;
    async function loadUsers() {
      setUsersLoading(true);
      try {
        const page = await listUsers(0, 200);
        if (cancelled) return;
        setUsers((page.content ?? []).filter((u) => u.enabled !== false));
        setUsersError(null);
      } catch (e) {
        if (cancelled) return;
        setUsers([]);
        setUsersError(e instanceof Error ? e.message : "Could not load users");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, appRole]);

  const usersById = useMemo(() => {
    const map = new Map<number, UserDTO>();
    for (const u of users) {
      if (u.id != null) map.set(u.id, u);
    }
    return map;
  }, [users]);

  function recipientLabel(id: number | string): string {
    const special = SPECIAL_RECIPIENT_LABELS.get(String(id));
    if (special) return special;
    const u = usersById.get(Number(id));
    return u?.displayName || u?.email || `User ${id}`;
  }

  function openEdit(event: NotificationEvent) {
    setDrawerEvent(event);
    setDrawerSelected(rules[event.id] ?? []);
  }

  function closeDrawer() {
    setDrawerEvent(null);
  }

  function toggleRecipient(id: number | string) {
    setDrawerSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function saveDrawer() {
    if (!drawerEvent || organizationId == null) return;
    const next = { ...rules, [drawerEvent.id]: drawerSelected };
    setRules(next);
    writeRules(organizationId, next);
    closeDrawer();
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
            Choose which team members — and, where appropriate, the
            customer contact or assigned worker — get emailed when a job
            reaches each event below.
          </p>
        </div>

        {usersError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {usersError}
          </p>
        ) : null}

        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const rows = NOTIFICATION_EVENTS.filter(
              (event) => event.category === category
            );
            if (rows.length === 0) return null;
            return (
              <CategorySection
                key={category}
                category={category}
                events={rows}
                rules={rules}
                recipientLabel={recipientLabel}
                onEdit={openEdit}
              />
            );
          })}
        </div>
      </div>

      <EnterpriseDrawer
        open={drawerEvent != null}
        onClose={closeDrawer}
        title={drawerEvent ? `Recipients — ${drawerEvent.label}` : "Recipients"}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={closeDrawer}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={saveDrawer}>
              Save
            </button>
          </div>
        }
      >
        <fieldset>
          <legend className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Recipients
          </legend>
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
            <div className="space-y-1.5">
              {usersLoading ? (
                <p className="text-sm text-slate-500">Loading users…</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-slate-500">No users found.</p>
              ) : (
                users.map((u) =>
                  u.id == null ? null : (
                    <label
                      key={u.id}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={drawerSelected.includes(u.id)}
                        onChange={() => toggleRecipient(u.id!)}
                      />
                      <span className="min-w-0 wrap-break-word">
                        {u.displayName || u.email}
                        {u.email ? ` (${u.email})` : ""}
                      </span>
                    </label>
                  )
                )
              )}
            </div>
          </div>
        </fieldset>
      </EnterpriseDrawer>
    </main>
  );
}

/** Recipient chips beyond this many collapse into one "+N more" chip. */
const MAX_VISIBLE_RECIPIENTS = 2;

function RecipientChips({
  ids,
  recipientLabel,
}: {
  ids: (number | string)[];
  recipientLabel: (id: number | string) => string;
}) {
  if (ids.length === 0) {
    return <span className="text-xs text-slate-400">No one selected</span>;
  }
  const visible = ids.slice(0, MAX_VISIBLE_RECIPIENTS);
  const overflow = ids.slice(MAX_VISIBLE_RECIPIENTS);
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((id) => (
        <span
          key={id}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
        >
          {recipientLabel(id)}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
          title={overflow.map(recipientLabel).join(", ")}
        >
          +{overflow.length} more
        </span>
      )}
    </div>
  );
}

interface CategorySectionProps {
  category: NotificationCategory;
  events: NotificationEvent[];
  rules: NotificationRules;
  recipientLabel: (id: number | string) => string;
  onEdit: (event: NotificationEvent) => void;
}

/** One category = its own card, spaced apart from the others — not one
 *  continuous table with inline section-header rows. */
function CategorySection({
  category,
  events,
  rules,
  recipientLabel,
  onEdit,
}: CategorySectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {category}
        </h3>
      </div>

      {/* Desktop / tablet: table */}
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
            {events.map((event, idx) => {
              const selected = rules[event.id] ?? [];
              return (
                <tr
                  key={event.id}
                  className={`border-t border-slate-100 ${
                    idx % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{event.label}</p>
                    <p className="text-xs text-slate-500">{event.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <RecipientChips ids={selected} recipientLabel={recipientLabel} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-orange-50"
                      onClick={() => onEdit(event)}
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" />
                      Edit recipients
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards, same pattern as the Jobs list */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {events.map((event) => {
          const selected = rules[event.id] ?? [];
          return (
            <article
              key={event.id}
              className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm"
            >
              <p className="font-semibold text-slate-900">{event.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{event.description}</p>
              <div className="mt-3">
                <RecipientChips ids={selected} recipientLabel={recipientLabel} />
              </div>
              <button
                type="button"
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50"
                onClick={() => onEdit(event)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit recipients
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
