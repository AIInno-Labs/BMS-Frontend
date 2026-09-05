/**
 * Quotient quote processing previously wrote through Supabase.
 * DEL-02 moves ingestion to Spring Boot — this module is intentionally inert.
 */
export async function processQuotePayload(_payload: unknown): Promise<void> {
  throw new Error(
    "processQuotePayload retired — use Spring Boot /webhooks/quotient (DEL-02)."
  );
}

export async function processAcceptedQuote(_payload: unknown): Promise<void> {
  throw new Error(
    "processAcceptedQuote retired — use Spring Boot /webhooks/quotient (DEL-02)."
  );
}
