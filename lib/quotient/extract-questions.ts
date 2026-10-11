import type { QuoteQuestion } from "@/lib/quotient/quote-types";

/**
 * Pulls the `customer_question` thread out of a raw `GET /quotes/{quoteNumber}`
 * response — events[] first, falling back to a top-level `questions` array,
 * then a single `payload.question`.
 *
 * Mirrors the `questionsFromEvents` derivation inside `normalizeQuote` in
 * QuoteDetailPage.tsx so both pages read a customer's question history the
 * same way, without importing that page's local (unexported) function.
 */
export function extractQuoteQuestions(raw: Record<string, unknown>): QuoteQuestion[] {
  const str = (v: unknown): string | null =>
    v === null || v === undefined || v === "" ? null : String(v);
  const nested = (
    obj: Record<string, unknown> | null,
    key: string
  ): Record<string, unknown> | null => {
    const value = obj?.[key];
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  };

  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const rawEvents = (raw.events ?? []) as Record<string, unknown>[];

  const questionsFromEvents: QuoteQuestion[] = rawEvents
    .filter((e) => String(e.eventCode ?? e.event_name ?? "") === "customer_question")
    .map((e) => {
      const q = nested((e.payload ?? {}) as Record<string, unknown>, "question") ?? {};
      return {
        id: String(e.id ?? ""),
        question_when: str(q.when) ?? str(e.occurredAt),
        question_text: String(q.text ?? "").trim(),
        asked_by:
          q.by && typeof q.by === "object" ? (q.by as Record<string, unknown>) : null,
        created_at: String(e.occurredAt ?? ""),
      };
    })
    .filter((q) => q.question_text)
    .sort((a, b) =>
      String(a.question_when ?? a.created_at).localeCompare(
        String(b.question_when ?? b.created_at)
      )
    );

  if (questionsFromEvents.length > 0) return questionsFromEvents;
  if (Array.isArray(raw.questions)) return raw.questions as QuoteQuestion[];

  const payloadQuestion = nested(payload, "question");
  if (payloadQuestion?.text) {
    return [
      {
        id: "payload-question",
        question_when: str(payloadQuestion.when),
        question_text: String(payloadQuestion.text),
        asked_by:
          payloadQuestion.by && typeof payloadQuestion.by === "object"
            ? (payloadQuestion.by as Record<string, unknown>)
            : null,
        created_at: String(payloadQuestion.when ?? raw.occurredAt ?? ""),
      },
    ];
  }
  return [];
}
