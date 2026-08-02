import type { QuotientWebhookPayload } from "@/lib/quotient/types";
import { SCOPE_CHECKLIST_ITEMS } from "@/lib/jobCardPrint";

const RESIN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bvefr\b/i, label: "VEFR" },
  { pattern: /\bvinyl\s*ester\b/i, label: "Vinyl Ester (VEFR)" },
  { pattern: /\bisofr\b/i, label: "IsoFR" },
  { pattern: /\bisophthalic\b/i, label: "Isophthalic Polyester (IsoFR)" },
  { pattern: /\bphenolic\b/i, label: "Phenolic" },
];

function inferResin(text: string): string {
  for (const { pattern, label } of RESIN_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return "Isophthalic Polyester (IsoFR)";
}

function inferSpecType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("handrail")) return "Handrail";
  if (t.includes("ladder")) return "Ladder";
  if (t.includes("walkway") || t.includes("platform")) return "Walkway";
  if (t.includes("trench")) return "Trench / Enclosure";
  if (t.includes("grating") || t.includes("grate")) return "Grating";
  if (t.includes("profile")) return "Profiles";
  return "Structure";
}

function buildScopeChecklist(title: string): Record<string, boolean> {
  const t = title.toLowerCase();
  const checklist: Record<string, boolean> = {};
  for (const item of SCOPE_CHECKLIST_ITEMS) {
    const key = item.toLowerCase();
    checklist[item] =
      (key === "grating" && (t.includes("grating") || t.includes("grate"))) ||
      (key === "handrails" && t.includes("handrail")) ||
      (key === "ladders" && t.includes("ladder")) ||
      (key === "structure" && (t.includes("structure") || t.includes("platform"))) ||
      (key === "profiles" && t.includes("profile")) ||
      (key === "installation" && t.includes("install")) ||
      (key === "drawings" && t.includes("drawing")) ||
      false;
  }
  return checklist;
}

export function quotientJobNumber(quoteNumber: number): string {
  return `JOB-Q-${quoteNumber}`;
}

export function mapQuotientPayloadToJobInsert(
  payload: QuotientWebhookPayload,
  quoteId: string
) {
  const company =
    payload.quote_for?.company_name?.trim() ||
    payload.for?.trim() ||
    "Unknown Customer";
  const first = payload.quote_for?.name_first?.trim() ?? "";
  const last = payload.quote_for?.name_last?.trim() ?? "";
  const contact = [first, last].filter(Boolean).join(" ") || null;
  const phone = payload.quote_for?.phone?.value ?? null;
  const email = payload.quote_for?.email ?? null;
  const resin = inferResin(
    [payload.title, payload.item_headings, ...(payload.selected_items ?? []).map((i) => `${i.heading} ${i.description}`)]
      .filter(Boolean)
      .join(" ")
  );
  const specType = inferSpecType(payload.title);
  const sent = payload.first_sent ? new Date(payload.first_sent) : new Date();
  const due = new Date(sent);
  due.setDate(due.getDate() + 21);

  return {
    job_number: quotientJobNumber(payload.quote_number),
    quote_id: quoteId,
    status: "Pending" as const,
    priority: "Normal" as const,
    job_date: sent.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    raised_by: payload.from?.trim() || "Quotient Webhook",
    customer_name: company,
    client_contact_name: contact,
    contact_phone: phone,
    contact_email: email,
    purchase_order_no: payload.accepted?.order_number ?? null,
    account_yes_no: true,
    transport: "To be confirmed",
    transport_company: null,
    freight_account: null,
    consignment_note: null,
    despatch_date: null,
    delivery_docket: null,
    delivery_instructions: payload.accepted?.comments ?? null,
    project_name: payload.title,
    scope_of_work_text: payload.item_headings ?? payload.title,
    scope_checklist: buildScopeChecklist(payload.title),
    spec_type: specType,
    construction_configuration: specType === "Grating" ? "Moulded" : null,
    thickness: null,
    mesh: null,
    resin_type: resin,
    colour: null,
    finish: null,
    nosing: null,
    manufacturing_required: true,
    install_required: /install/i.test(payload.title),
    qa_completed: false,
    estimated_hours: null,
    assigned_worker_name: null,
    manual_instructions: payload.accepted?.comments ?? "",
    notes: `Auto-created from Quotient quote #${payload.quote_number}`,
    alert_message: null,
    clip_rows: [],
    pack_dimensions: [],
    photo_checklist: [],
    bolt_list: [],
  };
}

export function mapSelectedItemsToMaterials(
  jobId: string,
  items: QuotientWebhookPayload["selected_items"]
) {
  if (!items?.length) return [];

  return items.map((item, index) => ({
    job_id: jobId,
    sl_no: index + 1,
    section: "Other" as const,
    item_description: [item.heading, item.description].filter(Boolean).join(" — ") || item.item_code || "Line item",
    qty: String(item.quantity ?? 1),
    unit: "ea",
    sort_order: index + 1,
  }));
}
