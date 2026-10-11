-- Run in Supabase SQL Editor if quote_events_history is not yet on your live project.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.quote_events_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotient_id TEXT NOT NULL,
  event_name TEXT NOT NULL
    CHECK (event_name IN (
      'quote_sent',
      'customer_viewed',
      'customer_question',
      'quote_accepted',
      'quote_declined',
      'quote_completed'
    )),
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_events_history_quotient_id
  ON public.quote_events_history (quotient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_events_history_event_name
  ON public.quote_events_history (event_name, created_at DESC);

ALTER TABLE public.quote_events_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_events_history_read_authenticated" ON public.quote_events_history;
CREATE POLICY "quote_events_history_read_authenticated" ON public.quote_events_history
  FOR SELECT TO authenticated USING (TRUE);

COMMENT ON TABLE public.quote_events_history IS 'Immutable archive of every Quotient webhook payload (all 6 events) for QA, analytics, and AI enhancement';
