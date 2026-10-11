import { createSupabaseAdmin } from "@/lib/supabase/server";
import { quotientJobNumber } from "@/lib/quotient/mapToJob";
import { mapQuoteLineItems, mapQuoteRow } from "@/lib/quotient/mapQuote";
import type { QuotientEventName, QuotientWebhookPayload } from "@/lib/quotient/types";

export async function upsertQuoteFromPayload(
  payload: QuotientWebhookPayload
): Promise<{ quoteId: string } | { error: string }> {
  const supabase = createSupabaseAdmin();
  const quoteRow = mapQuoteRow(payload);

  const { data: existing } = await supabase
    .from("quotes")
    .select("id")
    .eq("quotient_quote_number", payload.quote_number)
    .maybeSingle();

  let quoteId = existing?.id;

  if (quoteId) {
    const { error } = await supabase
      .from("quotes")
      .update(quoteRow)
      .eq("id", quoteId);
    if (error) return { error: error.message };
  } else {
    const { data: inserted, error } = await supabase
      .from("quotes")
      .insert(quoteRow)
      .select("id")
      .single();
    if (error || !inserted) {
      return { error: error?.message ?? "Quote insert failed" };
    }
    quoteId = inserted.id;
  }

  if (payload.selected_items?.length) {
    await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);
    const lines = mapQuoteLineItems(quoteId, payload.selected_items);
    const { error: lineErr } = await supabase
      .from("quote_line_items")
      .insert(lines);
    if (lineErr) {
      console.error("[quotient] quote_line_items", lineErr);
    }
  }

  return { quoteId };
}

export async function updateJobForQuotientEvent(
  payload: QuotientWebhookPayload,
  eventName: QuotientEventName
): Promise<void> {
  const supabase = createSupabaseAdmin();
  const jobNumber = quotientJobNumber(payload.quote_number);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  switch (eventName) {
    case "quote_completed":
      patch.status = "Complete";
      break;
    case "quote_declined":
      patch.status = "Cancelled";
      patch.alert_message = payload.declined?.comments
        ? `Quote declined: ${payload.declined.comments}`
        : "Quote declined in Quotient";
      break;
    case "customer_question":
      if (payload.question?.text) {
        patch.alert_message = `Customer question: ${payload.question.text.slice(0, 240)}`;
      }
      break;
    default:
      return;
  }

  await supabase.from("jobs").update(patch).eq("job_number", jobNumber);
}
