/**
 * Full Quotient-shaped demo payloads for FRP test quotes (99002, 99003, 111111).
 * Matches official sample field coverage; used by align script and webhook tests.
 */

export type DemoJourney = "complete" | "declined" | "accepted_open";

export interface DemoQuoteConfig {
  id: string;
  company: string;
  title: string;
  contactFirst: string;
  contactLast: string;
  email: string;
  phone: string;
  orderNumber: string;
  journey: DemoJourney;
  questions: string[];
  declinedComments?: string;
  lineItems?: QuotientLineItem[];
  itemHeadings?: string;
  totals?: { includesTax: number; excludesTax: number };
}

export interface QuotientLineItem {
  item_code: string;
  heading: string;
  description: string;
  sales_category: string;
  tax_rate: number;
  tax_description: string;
  subscription: string;
  discount: number;
  cost_price: number;
  unit_price: number;
  quantity: number;
  item_total: number;
}

const DEFAULT_ITEMS: QuotientLineItem[] = [
  {
    item_code: "FRP-GR-38",
    heading: "38mm Moulded Grating",
    description:
      "38mm thick 38x38 mesh VEFR Charcoal grit #3. Pultruded walkway panels per scope.",
    sales_category: "Fabrication",
    tax_rate: 10,
    tax_description: "10% GST",
    subscription: "",
    discount: 0,
    cost_price: 0,
    unit_price: 42000,
    quantity: 1,
    item_total: 42000,
  },
  {
    item_code: "FRP-CLIP-25",
    heading: "M clips and fasteners",
    description: "Box 25mm M clips — clip schedule per drawing.",
    sales_category: "Consumable",
    tax_rate: 10,
    tax_description: "10% GST",
    subscription: "",
    discount: 0,
    cost_price: 0,
    unit_price: 850,
    quantity: 24,
    item_total: 20400,
  },
  {
    item_code: "LAB-01",
    heading: "Lay-up labour",
    description: "Shop floor lay-up and QA inspection.",
    sales_category: "Billing",
    tax_rate: 10,
    tax_description: "10% GST",
    subscription: "",
    discount: 0,
    cost_price: 0,
    unit_price: 2000,
    quantity: 1,
    item_total: 2000,
  },
];

const ISOFR_25_ITEMS: QuotientLineItem[] = [
  {
    item_code: "FRP-GR-25",
    heading: "25mm Moulded Grating",
    description: "25mm thick 38x38 mesh IsoFR Safety Yellow grit #2 walkway panels.",
    sales_category: "Fabrication",
    tax_rate: 10,
    tax_description: "10% GST",
    subscription: "",
    discount: 0,
    cost_price: 0,
    unit_price: 38000,
    quantity: 1,
    item_total: 38000,
  },
  {
    item_code: "LAB-01",
    heading: "Lay-up labour",
    description: "Shop floor lay-up and QA inspection.",
    sales_category: "Billing",
    tax_rate: 10,
    tax_description: "10% GST",
    subscription: "",
    discount: 0,
    cost_price: 0,
    unit_price: 2000,
    quantity: 1,
    item_total: 2000,
  },
];

export const DEMO_QUOTES: DemoQuoteConfig[] = [
  {
    id: "99002",
    company: "Pacific Mining Logistics",
    title: "38mm Moulded Grating Platform — VEFR Charcoal 38x38",
    contactFirst: "Alex",
    contactLast: "Morgan",
    email: "alex.morgan@pacific-mining.test",
    phone: "08 9123 4567",
    orderNumber: "PO-99002",
    journey: "complete",
    questions: [
      "Can you confirm lead time for grit nosing on treads?",
      "Please confirm delivery window for week 24.",
    ],
    lineItems: DEFAULT_ITEMS,
    itemHeadings: "38mm Moulded Grating\nClips and fasteners\nLay-up labour",
    totals: { includesTax: 48500, excludesTax: 44000 },
  },
  {
    id: "99003",
    company: "Apex Infrastructure Contractors",
    title: "Walkway grating supply — IsoFR yellow 25mm",
    contactFirst: "Jordan",
    contactLast: "Reid",
    email: "jordan.reid@apex-infra.test",
    phone: "08 9234 5678",
    orderNumber: "PO-99003",
    journey: "declined",
    questions: ["Is phenolic resin available for this specification?"],
    declinedComments: "Budget reallocated this quarter.",
    lineItems: ISOFR_25_ITEMS,
    itemHeadings: "25mm Moulded Grating\nLay-up labour",
    totals: { includesTax: 44000, excludesTax: 40000 },
  },
  {
    id: "111111",
    company: "Northern Pilbara Fabricators",
    title: "FRP platform grating — 38mm VEFR",
    contactFirst: "Sam",
    contactLast: "Cole",
    email: "sam.cole@pilbara-fab.test",
    phone: "08 9345 6789",
    orderNumber: "PO-111111",
    journey: "accepted_open",
    questions: ["Can you confirm mesh size for the stair landings?"],
    lineItems: DEFAULT_ITEMS,
    itemHeadings: "38mm Moulded Grating\nClips and fasteners\nLay-up labour",
    totals: { includesTax: 48500, excludesTax: 44000 },
  },
];

export function demoQuoteEventSequence(demo: DemoQuoteConfig): string[] {
  const events: string[] = ["quote_sent", "customer_viewed"];
  for (let i = 0; i < demo.questions.length; i++) {
    events.push("customer_question");
  }
  if (demo.journey === "declined") {
    events.push("quote_accepted", "quote_declined");
  } else if (demo.journey === "complete") {
    events.push("quote_accepted", "quote_completed");
  } else {
    events.push("quote_accepted");
  }
  return events;
}

export function frpQuotientPayload(
  demo: DemoQuoteConfig,
  event_name: string,
  questionText?: string
): Record<string, unknown> {
  const quoteNumber = demo.id;
  const quoteNum = Number(quoteNumber);
  const sent = new Date("2026-05-20T08:00:00Z");
  const valid = new Date("2026-06-20T17:00:00Z");
  const items = demo.lineItems ?? DEFAULT_ITEMS;
  const totals = demo.totals ?? { includesTax: 48500, excludesTax: 44000 };

  const quote_for = {
    name_first: demo.contactFirst,
    name_last: demo.contactLast,
    email: demo.email,
    company_name: demo.company,
    phone: { type: "Primary Phone", value: demo.phone },
    address: {
      type: "Postal Address",
      street: "12 Industrial Drive",
      city: "Perth",
      state: "WA",
      zip: "6000",
      country: "Australia",
    },
  };

  let quoteStatus = "Awaiting Acceptance";
  let progress = "Active";
  if (event_name === "quote_accepted") quoteStatus = "Accepted";
  if (event_name === "quote_declined") quoteStatus = "Declined";
  if (event_name === "quote_completed") {
    quoteStatus = "Accepted";
    progress = "Complete";
  }

  const base: Record<string, unknown> = {
    event_name,
    quote_number: quoteNum,
    title: demo.title,
    quote_url: `https://www.quotientapp.com/quotes/${quoteNumber}`,
    from: "FRP Engineering Sales",
    for: demo.company,
    first_sent: sent.toISOString(),
    valid_until: valid.toISOString(),
    quote_status: quoteStatus,
    progress,
    is_archived: event_name === "quote_completed",
    currency: "AUD",
    amounts_are: "Tax Exclusive (Inclusive Total)",
    overall_discount: 0,
    quote_for,
    item_headings: demo.itemHeadings ?? "Line items",
    total_includes_tax: totals.includesTax,
    total_excludes_tax: totals.excludesTax,
    discount_amount_includes_tax: 0,
    discount_amount_excludes_tax: 0,
    deposit_percent: 0,
    deposit_amount_includes_tax: 0,
    deposit_amount_excludes_tax: 0,
    selected_items: items,
  };

  if (event_name === "customer_viewed") {
    base.viewed = {
      when: new Date().toISOString(),
      total_views: "2",
      by: quote_for,
    };
  }

  if (event_name === "customer_question" && questionText) {
    base.question = {
      when: new Date().toISOString(),
      text: questionText,
      by: quote_for,
    };
  }

  if (event_name === "quote_accepted" || event_name === "quote_completed") {
    base.accepted = {
      accepted_on_behalf: false,
      accepted_on_behalf_who: "",
      order_number: demo.orderNumber,
      comments: "Proceed with manufacture per accepted scope.",
      when: new Date().toISOString(),
      by: quote_for,
    };
  }

  if (event_name === "quote_declined") {
    base.declined = {
      marked_as_declined: false,
      comments: demo.declinedComments ?? "Project deferred.",
      when: new Date().toISOString(),
      by: quote_for,
    };
  }

  return base;
}
