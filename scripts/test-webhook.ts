/**
 * End-to-end Quotient webhook test — full payloads, Next.js + PostgreSQL trigger.
 * npm run test:webhook  (requires: npm run dev + schema.sql + QUOTIENT_WEBHOOK_SECRET in .env.local)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_QUOTES,
  demoQuoteEventSequence,
  frpQuotientPayload,
} from "../lib/quotient/demo-payloads";

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const BASE = process.env.WEBHOOK_TEST_URL ?? "http://localhost:3000";
const SECRET = process.env.QUOTIENT_WEBHOOK_SECRET ?? "dev-webhook-secret-test";

const demoA = DEMO_QUOTES.find((d) => d.id === "99002")!;
const demoB = DEMO_QUOTES.find((d) => d.id === "99003")!;

const QUOTE_A = demoA.id;
const JOB_A = `JOB-Q-${QUOTE_A}`;
const QUOTE_B = demoB.id;
const JOB_B = `JOB-Q-${QUOTE_B}`;

const results: { event: string; http: number; ms: number; status?: string; ok: boolean; note?: string }[] =
  [];

async function postPayload(quotientId: string, payload: Record<string, unknown>) {
  const event_name = String(payload.event_name);
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/webhooks/quotient`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(payload),
  });
  const ms = Date.now() - t0;
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  const ok = res.status === 200 && body.ok === true;
  return { event_name, res, ms, body, ok };
}

async function waitForLatestHistory(
  supabase: SupabaseClient,
  quotientId: string,
  event_name: string,
  maxMs = 10000
) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("quote_events_history")
      .select("id, processing_status, processing_error")
      .eq("quotient_id", quotientId)
      .eq("event_name", event_name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      await new Promise((r) => setTimeout(r, 150));
      continue;
    }
    if (data.processing_status === "processed") return data;
    if (data.processing_status === "failed") {
      throw new Error(`${event_name}: ${data.processing_error ?? "trigger failed"}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timeout waiting for ${event_name} on quote ${quotientId}`);
}

async function main() {
  console.log("═".repeat(60));
  console.log("Quotient E2E — full payloads (Next.js → Supabase trigger)");
  console.log(`Target: ${BASE}/api/webhooks/quotient`);
  console.log("═".repeat(60));

  const health = await fetch(`${BASE}/api/webhooks/quotient`);
  if (!health.ok) {
    console.error(`\n✗ Next.js not reachable (${health.status}). Run: npm run dev`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("\n✗ Missing Supabase keys in .env.local");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  async function fireDemo(
    demo: typeof demoA,
    event_name: string,
    questionText?: string,
    note?: string
  ) {
    const payload = frpQuotientPayload(demo, event_name, questionText);
    const { res, ms, body, ok } = await postPayload(demo.id, payload);
    let status: string | undefined;
    if (ok) {
      try {
        const row = await waitForLatestHistory(supabase, demo.id, event_name);
        status = row.processing_status;
      } catch (e) {
        results.push({
          event: event_name,
          http: res.status,
          ms,
          ok: false,
          note: e instanceof Error ? e.message : String(e),
        });
        return;
      }
    }
    results.push({
      event: event_name,
      http: res.status,
      ms,
      status,
      ok: ok && status === "processed",
      note: note ?? (body.error as string | undefined),
    });
    const icon = results[results.length - 1].ok ? "✓" : "✗";
    console.log(
      `  ${icon} ${event_name.padEnd(22)} HTTP ${res.status} ${ms}ms → DB ${status ?? "—"}`
    );
  }

  console.log(`\n── Quote ${QUOTE_A} (journey → Complete) ──`);
  let qIdx = 0;
  for (const event_name of demoQuoteEventSequence(demoA)) {
    const questionText =
      event_name === "customer_question" ? demoA.questions[qIdx++] : undefined;
    const note =
      event_name === "customer_question" && qIdx === 1
        ? "before job exists — alert skipped OK"
        : event_name === "customer_question" && qIdx === 2
          ? "after accept — sets job alert"
          : event_name === "quote_accepted"
            ? "creates JOB + materials + labour + specs"
            : undefined;
    await fireDemo(demoA, event_name, questionText, note);
  }

  console.log(`\n── Quote ${QUOTE_B} (journey → Declined) ──`);
  qIdx = 0;
  for (const event_name of demoQuoteEventSequence(demoB)) {
    const questionText =
      event_name === "customer_question" ? demoB.questions[qIdx++] : undefined;
    await fireDemo(demoB, event_name, questionText);
  }

  console.log("\n── Assertions ──");

  const { data: quoteA } = await supabase
    .from("quotes")
    .select("quotient_quote_id, status, journey_outcome, factory_job_status")
    .eq("quotient_quote_id", QUOTE_A)
    .single();
  if (!quoteA) throw new Error(`quotes missing for ${QUOTE_A}`);
  if (quoteA.journey_outcome !== "completed") {
    throw new Error(`Expected journey completed, got ${quoteA.journey_outcome}`);
  }
  console.log(
    `  ✓ quotes ${QUOTE_A}: status=${quoteA.status}, journey=${quoteA.journey_outcome}, factory=${quoteA.factory_job_status}`
  );

  const { data: jobA } = await supabase
    .from("jobs")
    .select("id, workflow_status, resin_type, mesh_size, colour, alert_message, client_contact_name")
    .eq("id", JOB_A)
    .single();
  if (!jobA) throw new Error(`job missing ${JOB_A}`);
  if (jobA.workflow_status !== "Complete") {
    throw new Error(`Expected Complete, got ${jobA.workflow_status}`);
  }
  if (jobA.resin_type !== "VEFR" || jobA.mesh_size !== "38x38" || jobA.colour !== "Charcoal") {
    throw new Error(`Spec mapping failed: ${JSON.stringify(jobA)}`);
  }
  if (!jobA.alert_message?.includes("Customer question")) {
    throw new Error("Expected customer_question alert on job");
  }
  if (jobA.client_contact_name !== "Alex Morgan") {
    throw new Error(`Expected contact Alex Morgan, got ${jobA.client_contact_name}`);
  }
  console.log(`  ✓ job ${JOB_A}: Complete, VEFR/38x38/Charcoal, alert set`);

  const { count: matCount } = await supabase
    .from("job_materials")
    .select("*", { count: "exact", head: true })
    .eq("job_id", JOB_A);
  const { count: labCount } = await supabase
    .from("job_labor")
    .select("*", { count: "exact", head: true })
    .eq("job_id", JOB_A);
  const { data: quoteARow } = await supabase
    .from("quotes")
    .select("id")
    .eq("quotient_quote_id", QUOTE_A)
    .single();
  const { count: lineCount } = await supabase
    .from("quote_line_items")
    .select("*", { count: "exact", head: true })
    .eq("quote_id", quoteARow!.id);
  if (!matCount || !labCount || !lineCount) {
    throw new Error("materials, labour, or line_items missing");
  }
  console.log(
    `  ✓ job_materials: ${matCount}, job_labor: ${labCount}, quote_line_items: ${lineCount}`
  );

  const { data: quoteB } = await supabase
    .from("quotes")
    .select("journey_outcome, status")
    .eq("quotient_quote_id", QUOTE_B)
    .single();
  if (quoteB?.journey_outcome !== "declined" || quoteB?.status !== "Declined") {
    throw new Error(`Quote B journey should be declined: ${JSON.stringify(quoteB)}`);
  }

  const { data: jobB } = await supabase
    .from("jobs")
    .select("workflow_status, client_contact_name")
    .eq("id", JOB_B)
    .single();
  if (jobB?.workflow_status !== "Cancelled") {
    throw new Error(`Quote B job should be Cancelled, got ${jobB?.workflow_status}`);
  }
  if (jobB?.client_contact_name !== "Jordan Reid") {
    throw new Error(`Expected contact Jordan Reid, got ${jobB?.client_contact_name}`);
  }
  console.log(`  ✓ job ${JOB_B}: Cancelled, journey declined`);

  const { data: history } = await supabase
    .from("quote_events_history")
    .select("event_name, processing_status")
    .in("quotient_id", [QUOTE_A, QUOTE_B])
    .order("created_at", { ascending: true });
  const failed = (history ?? []).filter((h) => h.processing_status !== "processed");
  if (failed.length) {
    throw new Error(`Failed history rows: ${JSON.stringify(failed)}`);
  }
  console.log(`  ✓ ${history?.length ?? 0} history rows all processed`);

  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("═".repeat(60));
  for (const r of results) {
    console.log(
      `${r.ok ? "✓" : "✗"} ${r.event.padEnd(22)} HTTP ${r.http}  ${String(r.ms).padStart(4)}ms  DB:${r.status ?? "—"}`
    );
  }

  const allOk = results.every((r) => r.ok);
  console.log("\n" + (allOk ? "✓ All events passed E2E" : "✗ Some events failed"));
  if (!allOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
