/**
 * Inspect Quotient quote in Supabase: history, quotes, jobs, materials, labor.
 * Usage: npx tsx scripts/inspect-quote.ts 111111
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const quotientId = process.argv[2] ?? "111111";
const jobId = `JOB-Q-${quotientId}`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const EVENTS = [
  "quote_sent",
  "customer_viewed",
  "customer_question",
  "quote_accepted",
  "quote_declined",
  "quote_completed",
] as const;

async function main() {
  const { data: history, error: histErr } = await supabase
    .from("quote_events_history")
    .select("id, quotient_id, event_name, processing_status, processing_error, created_at")
    .eq("quotient_id", quotientId)
    .order("created_at", { ascending: true });

  if (histErr) throw new Error(histErr.message);

  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select(
      "id, quotient_quote_id, customer_name, total_amount, status, currency, title, journey_outcome, factory_job_status, last_event_name, quote_for_name_first, quote_for_name_last, quote_for_email, quote_for_phone, total_includes_tax, total_excludes_tax, created_at, updated_at"
    )
    .eq("quotient_quote_id", quotientId)
    .maybeSingle();

  const { count: lineItemCount } = quote
    ? await supabase
        .from("quote_line_items")
        .select("*", { count: "exact", head: true })
        .eq("quote_id", quote.id)
    : { count: 0 };

  const { count: questionCount } = quote
    ? await supabase
        .from("quote_questions")
        .select("*", { count: "exact", head: true })
        .eq("quote_id", quote.id)
    : { count: 0 };

  if (quoteErr) throw new Error(quoteErr.message);

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr) throw new Error(jobErr.message);

  const { data: materials } = await supabase
    .from("job_materials")
    .select("sl_no, section, item_description, item_code, qty, unit_price, line_total")
    .eq("job_id", jobId)
    .order("sl_no");

  const { data: labor } = await supabase
    .from("job_labor")
    .select("sl_no, labor_category, description, hours_estimated, rate_aud, line_total")
    .eq("job_id", jobId)
    .order("sl_no");

  const eventsPresent = new Set(history?.map((h) => h.event_name) ?? []);
  const eventsMissing = EVENTS.filter((e) => !eventsPresent.has(e));

  const latestPayload = history?.length
    ? (
        await supabase
          .from("quote_events_history")
          .select("event_name, raw_payload")
          .eq("quotient_id", quotientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
      ).data?.raw_payload
    : null;

  console.log("\n=== QUOTE", quotientId, "===\n");
  console.log("History rows:", history?.length ?? 0);
  console.log(
    "Events:",
    EVENTS.map((e) => `${eventsPresent.has(e) ? "✓" : "✗"} ${e}`).join("\n       ")
  );
  if (eventsMissing.length) console.log("Missing:", eventsMissing.join(", "));

  console.log("\n--- quote_events_history (timeline) ---");
  for (const h of history ?? []) {
    console.log(
      `  ${h.created_at} | ${h.event_name.padEnd(18)} | ${h.processing_status}${h.processing_error ? ` | ERR: ${h.processing_error}` : ""}`
    );
  }

  console.log("\n--- quotes row ---");
  if (quote) {
    console.log(JSON.stringify(quote, null, 2));
    console.log(`  line_items: ${lineItemCount ?? 0}  |  questions: ${questionCount ?? 0}`);
  } else {
    console.log("  (none)");
  }

  console.log("\n--- jobs row (", jobId, ") ---");
  if (job) {
    const {
      id,
      workflow_status,
      customer_name,
      project_name,
      date_raised,
      due_date,
      raised_by,
      client_contact_name,
      delivery_instructions,
      transport_company,
      product_category,
      mesh_size,
      thickness_mm,
      resin_type,
      finish_type,
      colour,
      manufacturing_required,
      install_required,
      qa_completed,
      alert_message,
      estimated_hours,
    } = job;
    console.log(
      JSON.stringify(
        {
          id,
          workflow_status,
          customer_name,
          project_name,
          date_raised,
          due_date,
          raised_by,
          client_contact_name,
          delivery_instructions,
          transport_company,
          product_category,
          mesh_size,
          thickness_mm,
          resin_type,
          finish_type,
          colour,
          manufacturing_required,
          install_required,
          qa_completed,
          alert_message,
          estimated_hours,
        },
        null,
        2
      )
    );
  } else {
    console.log("  (none — job only created on quote_accepted)");
  }

  console.log("\n--- job_materials (", materials?.length ?? 0, "rows) ---");
  console.log(JSON.stringify(materials ?? [], null, 2));

  console.log("\n--- job_labor (", labor?.length ?? 0, "rows) ---");
  console.log(JSON.stringify(labor ?? [], null, 2));

  if (latestPayload && typeof latestPayload === "object") {
    const p = latestPayload as Record<string, unknown>;
    const qf = p.quote_for as Record<string, unknown> | undefined;
    const accepted = p.accepted as Record<string, unknown> | undefined;
    const viewed = p.viewed as Record<string, unknown> | undefined;
    const question = p.question as Record<string, unknown> | undefined;
    const declined = p.declined as Record<string, unknown> | undefined;
    console.log("\n--- latest raw_payload highlights ---");
    console.log(
      JSON.stringify(
        {
          event_name: p.event_name,
          quote_status: p.quote_status,
          progress: p.progress,
          quote_url: p.quote_url,
          contact:
            qf &&
            [qf.name_first, qf.name_last].filter(Boolean).join(" "),
          email: qf?.email,
          phone: (qf?.phone as { value?: string })?.value,
          order_number: accepted?.order_number,
          accepted_comments: accepted?.comments,
          viewed_when: viewed?.when,
          viewed_count: viewed?.total_views,
          question_text: question?.text
            ? String(question.text).slice(0, 80) + "…"
            : null,
          declined_comments: declined?.comments,
          line_items: Array.isArray(p.selected_items)
            ? (p.selected_items as unknown[]).length
            : 0,
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
