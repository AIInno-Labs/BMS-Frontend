-- Quotient webhook compliance — run in Supabase SQL Editor on live projects.
-- Extends quotes / line items / history per https://www.quotientapp.com/help/quotient-webhooks

-- quotes: additional Quotient header & event-specific fields
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_from TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_amount_includes_tax NUMERIC(14, 2);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_amount_excludes_tax NUMERIC(14, 2);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_amount_includes_tax NUMERIC(14, 2);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deposit_amount_excludes_tax NUMERIC(14, 2);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS accepted_on_behalf BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_comments TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS view_count INTEGER;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_question_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_question_text TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

-- quote_line_items: full selected_items[] fields from Quotient
ALTER TABLE public.quote_line_items ADD COLUMN IF NOT EXISTS tax_description TEXT;
ALTER TABLE public.quote_line_items ADD COLUMN IF NOT EXISTS line_discount NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.quote_line_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(14, 2);

-- quote_events_history: processing observability (retries / partial failures)
ALTER TABLE public.quote_events_history ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'received'
  CHECK (processing_status IN ('received', 'processed', 'partial', 'failed'));
ALTER TABLE public.quote_events_history ADD COLUMN IF NOT EXISTS processing_error TEXT;

CREATE INDEX IF NOT EXISTS idx_quote_events_history_processing
  ON public.quote_events_history (processing_status, created_at DESC);
