/**
 * Replays webhook history (chronological) for demo Quotient quotes.
 * Aligns quotes, line_items, questions, and jobs with the same pipeline as quote 111112.
 * Quote 111112 is never modified (protected by default).
 *
 * Usage: npm run align:quotes
 *        npx tsx scripts/align-quotient-quotes.ts --exclude=111112,1249
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const EXCLUDE = new Set(
  (process.argv.find((a) => a.startsWith("--exclude="))?.split("=")[1] ?? "111112")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function replayQuote(demo: (typeof DEMO_QUOTES)[0]) {
  const qid = demo.id;
  console.log(`\n── Quote ${qid} ──`);

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("id")
    .eq("quotient_quote_id", qid)
    .maybeSingle();

  if (quoteRow?.id) {
    await supabase.from("quote_questions").delete().eq("quote_id", quoteRow.id);
    await supabase.from("quote_line_items").delete().eq("quote_id", quoteRow.id);
  }

  await supabase.from("quote_events_history").delete().eq("quotient_id", qid);
  await supabase.from("job_materials").delete().eq("job_id", `JOB-Q-${qid}`);
  await supabase.from("job_labor").delete().eq("job_id", `JOB-Q-${qid}`);
  await supabase.from("jobs").delete().eq("id", `JOB-Q-${qid}`);
  await supabase.from("quotes").delete().eq("quotient_quote_id", qid);

  const events = demoQuoteEventSequence(demo);
  let qIndex = 0;

  for (const event_name of events) {
    const questionText =
      event_name === "customer_question" ? demo.questions[qIndex++] : undefined;

    const payload = frpQuotientPayload(demo, event_name, questionText);

    const { data: inserted, error } = await supabase
      .from("quote_events_history")
      .insert({
        quotient_id: qid,
        event_name,
        raw_payload: payload,
        processing_status: "received",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ insert ${event_name}:`, error.message);
      continue;
    }

    const { error: rpcErr } = await supabase.rpc("process_quotient_history_record", {
      p_history_id: inserted.id,
    });

    if (rpcErr) {
      console.error(`  ✗ process ${event_name}:`, rpcErr.message);
    } else {
      console.log(`  ✓ ${event_name}`);
    }
  }
}

async function replayExistingFromHistory(id: string) {
  console.log(`\n── Replaying existing quote ${id} from history ──`);
  const { data: rows } = await supabase
    .from("quote_events_history")
    .select("id")
    .eq("quotient_id", id)
    .order("created_at", { ascending: true });

  const { data: quoteRow } = await supabase
    .from("quotes")
    .select("id")
    .eq("quotient_quote_id", id)
    .maybeSingle();
  if (quoteRow?.id) {
    await supabase.from("quote_questions").delete().eq("quote_id", quoteRow.id);
  }

  for (const row of rows ?? []) {
    const { error } = await supabase.rpc("process_quotient_history_record", {
      p_history_id: row.id,
    });
    console.log(`  ${error ? "✗" : "✓"} replay ${row.id}`);
  }
}

async function main() {
  console.log("Align Quotient demo quotes (excluded:", [...EXCLUDE].join(", "), ")");

  const { data: existing } = await supabase
    .from("quotes")
    .select("quotient_quote_id")
    .order("quotient_quote_id");

  const existingIds = new Set((existing ?? []).map((r) => r.quotient_quote_id as string));
  const demoIds = new Set(DEMO_QUOTES.map((d) => d.id));

  for (const demo of DEMO_QUOTES) {
    if (EXCLUDE.has(demo.id)) {
      console.log(`\n── Skip ${demo.id} (protected) ──`);
      continue;
    }
    await replayQuote(demo);
  }

  for (const id of existingIds) {
    if (EXCLUDE.has(id) || demoIds.has(id)) continue;
    await replayExistingFromHistory(id);
  }

  console.log("\n✓ Alignment complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
