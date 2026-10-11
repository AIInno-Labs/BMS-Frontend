-- Quotient field mirror: quotes expansion, line items, question thread, enhanced trigger

-- ---------------------------------------------------------------------------
-- quotes — Quotient-aligned columns (quotient_quote_id = quote_number)
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS last_event_name TEXT,
  ADD COLUMN IF NOT EXISTS journey_outcome TEXT NOT NULL DEFAULT 'open'
    CHECK (journey_outcome IN ('open', 'accepted', 'declined', 'completed')),
  ADD COLUMN IF NOT EXISTS factory_job_status TEXT,
  ADD COLUMN IF NOT EXISTS quote_url TEXT,
  ADD COLUMN IF NOT EXISTS quote_from TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_label TEXT,
  ADD COLUMN IF NOT EXISTS first_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS quote_status TEXT,
  ADD COLUMN IF NOT EXISTS progress TEXT,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS amounts_are TEXT,
  ADD COLUMN IF NOT EXISTS overall_discount NUMERIC(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_includes_tax NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS total_excludes_tax NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_amount_includes_tax NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS discount_amount_excludes_tax NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS deposit_percent NUMERIC(8, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount_includes_tax NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS deposit_amount_excludes_tax NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS item_headings TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_name_first TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_name_last TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_email TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_phone TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_phone_type TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_street TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_city TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_state TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_zip TEXT,
  ADD COLUMN IF NOT EXISTS quote_for_country TEXT,
  ADD COLUMN IF NOT EXISTS accepted_order_number TEXT,
  ADD COLUMN IF NOT EXISTS accepted_comments TEXT,
  ADD COLUMN IF NOT EXISTS accepted_when TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_on_behalf BOOLEAN,
  ADD COLUMN IF NOT EXISTS accepted_by JSONB,
  ADD COLUMN IF NOT EXISTS declined_comments TEXT,
  ADD COLUMN IF NOT EXISTS declined_when TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_by JSONB,
  ADD COLUMN IF NOT EXISTS viewed_when TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_total_views INTEGER,
  ADD COLUMN IF NOT EXISTS viewed_by JSONB,
  ADD COLUMN IF NOT EXISTS last_question_text TEXT,
  ADD COLUMN IF NOT EXISTS last_question_when TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_question_by JSONB;

CREATE INDEX IF NOT EXISTS idx_quotes_journey_outcome ON public.quotes (journey_outcome);
CREATE INDEX IF NOT EXISTS idx_quotes_last_event ON public.quotes (last_event_name);
CREATE INDEX IF NOT EXISTS idx_quotes_factory_status ON public.quotes (factory_job_status);

-- Sync legacy columns from new fields where empty
UPDATE public.quotes SET quote_status = status WHERE quote_status IS NULL AND status IS NOT NULL;
UPDATE public.quotes SET total_includes_tax = total_amount WHERE total_includes_tax IS NULL AND total_amount IS NOT NULL;

-- ---------------------------------------------------------------------------
-- quote_line_items — selected_items[] mirror
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  sl_no INTEGER NOT NULL CHECK (sl_no >= 1),
  item_code TEXT,
  heading TEXT,
  description TEXT,
  sales_category TEXT,
  tax_rate TEXT,
  tax_description TEXT,
  subscription TEXT,
  discount NUMERIC(14, 2) DEFAULT 0,
  cost_price NUMERIC(14, 2),
  unit_price NUMERIC(14, 2),
  quantity NUMERIC(14, 3),
  item_total NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quote_id, sl_no)
);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote ON public.quote_line_items (quote_id, sl_no);

-- ---------------------------------------------------------------------------
-- quote_questions — full customer question conversation thread
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  history_id UUID REFERENCES public.quote_events_history (id) ON DELETE SET NULL,
  question_when TIMESTAMPTZ,
  question_text TEXT NOT NULL,
  asked_by JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_questions_quote ON public.quote_questions (quote_id, question_when ASC);

-- ---------------------------------------------------------------------------
-- Helper: upsert quote_line_items from selected_items[]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_quote_line_items(p_quote_id UUID, p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_sl INT := 0;
  v_qty NUMERIC;
BEGIN
  DELETE FROM quote_line_items WHERE quote_id = p_quote_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'selected_items', '[]'::JSONB))
  LOOP
    v_sl := v_sl + 1;
    v_qty := (v_item ->> 'quantity')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      v_qty := 1;
    END IF;

    INSERT INTO quote_line_items (
      quote_id, sl_no, item_code, heading, description, sales_category,
      tax_rate, tax_description, subscription, discount, cost_price,
      unit_price, quantity, item_total
    ) VALUES (
      p_quote_id,
      v_sl,
      v_item ->> 'item_code',
      v_item ->> 'heading',
      v_item ->> 'description',
      v_item ->> 'sales_category',
      CASE WHEN v_item ->> 'tax_rate' IS NOT NULL THEN v_item ->> 'tax_rate' END,
      v_item ->> 'tax_description',
      NULLIF(v_item ->> 'subscription', ''),
      COALESCE((v_item ->> 'discount')::NUMERIC, 0),
      (v_item ->> 'cost_price')::NUMERIC,
      (v_item ->> 'unit_price')::NUMERIC,
      v_qty,
      (v_item ->> 'item_total')::NUMERIC
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Enhanced row processor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_quotient_history_row(p_row public.quote_events_history)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
  v_event TEXT;
  v_quotient_id TEXT;
  v_quote_id UUID;
  v_job_id TEXT;
  v_item JSONB;
  v_mat_sl INT;
  v_lab_sl INT;
  v_desc TEXT;
  v_is_labor BOOLEAN;
  v_search TEXT;
  v_specs RECORD;
  v_question TEXT;
  v_section TEXT;
  v_qty NUMERIC;
  v_contact TEXT;
  v_journey TEXT;
BEGIN
  v_payload := p_row.raw_payload;
  v_event := p_row.event_name;
  v_quotient_id := p_row.quotient_id;
  v_job_id := 'JOB-Q-' || v_quotient_id;

  UPDATE quote_events_history
  SET processing_status = 'processing', processing_error = NULL
  WHERE id = p_row.id;

  v_journey := CASE v_event
    WHEN 'quote_completed' THEN 'completed'
    WHEN 'quote_declined' THEN 'declined'
    WHEN 'quote_accepted' THEN 'accepted'
    ELSE 'open'
  END;

  v_contact := trim(both ' ' from concat_ws(' ',
    v_payload #>> '{quote_for,name_first}',
    v_payload #>> '{quote_for,name_last}'
  ));

  INSERT INTO quotes (
    quotient_quote_id, customer_name, total_amount, status, currency, title, raw_payload,
    last_event_name, journey_outcome,
    quote_url, quote_from, quote_for_label, first_sent, valid_until,
    quote_status, progress, is_archived, amounts_are, overall_discount,
    total_includes_tax, total_excludes_tax,
    discount_amount_includes_tax, discount_amount_excludes_tax,
    deposit_percent, deposit_amount_includes_tax, deposit_amount_excludes_tax,
    item_headings,
    quote_for_name_first, quote_for_name_last, quote_for_email,
    quote_for_phone, quote_for_phone_type,
    quote_for_street, quote_for_city, quote_for_state, quote_for_zip, quote_for_country,
    accepted_order_number, accepted_comments, accepted_when, accepted_on_behalf, accepted_by,
    declined_comments, declined_when, declined_by,
    viewed_when, viewed_total_views, viewed_by,
    last_question_text, last_question_when, last_question_by
  )
  VALUES (
    v_quotient_id,
    COALESCE(v_payload #>> '{quote_for,company_name}', v_payload ->> 'for', 'Unknown Customer'),
    COALESCE((v_payload ->> 'total_includes_tax')::NUMERIC, (v_payload ->> 'total_excludes_tax')::NUMERIC),
    COALESCE(v_payload ->> 'quote_status', 'Unknown'),
    COALESCE(v_payload ->> 'currency', 'AUD'),
    v_payload ->> 'title',
    v_payload,
    v_event,
    v_journey,
    v_payload ->> 'quote_url',
    v_payload ->> 'from',
    v_payload ->> 'for',
    (v_payload ->> 'first_sent')::TIMESTAMPTZ,
    (v_payload ->> 'valid_until')::DATE,
    v_payload ->> 'quote_status',
    v_payload ->> 'progress',
    COALESCE((v_payload ->> 'is_archived')::BOOLEAN, FALSE),
    v_payload ->> 'amounts_are',
    COALESCE((v_payload ->> 'overall_discount')::NUMERIC, 0),
    (v_payload ->> 'total_includes_tax')::NUMERIC,
    (v_payload ->> 'total_excludes_tax')::NUMERIC,
    (v_payload ->> 'discount_amount_includes_tax')::NUMERIC,
    (v_payload ->> 'discount_amount_excludes_tax')::NUMERIC,
    COALESCE((v_payload ->> 'deposit_percent')::NUMERIC, 0),
    (v_payload ->> 'deposit_amount_includes_tax')::NUMERIC,
    (v_payload ->> 'deposit_amount_excludes_tax')::NUMERIC,
    v_payload ->> 'item_headings',
    v_payload #>> '{quote_for,name_first}',
    v_payload #>> '{quote_for,name_last}',
    v_payload #>> '{quote_for,email}',
    v_payload #>> '{quote_for,phone,value}',
    v_payload #>> '{quote_for,phone,type}',
    v_payload #>> '{quote_for,address,street}',
    v_payload #>> '{quote_for,address,city}',
    v_payload #>> '{quote_for,address,state}',
    v_payload #>> '{quote_for,address,zip}',
    v_payload #>> '{quote_for,address,country}',
    v_payload #>> '{accepted,order_number}',
    v_payload #>> '{accepted,comments}',
    (v_payload #>> '{accepted,when}')::TIMESTAMPTZ,
    (v_payload #>> '{accepted,accepted_on_behalf}')::BOOLEAN,
    v_payload -> 'accepted' -> 'by',
    v_payload #>> '{declined,comments}',
    (v_payload #>> '{declined,when}')::TIMESTAMPTZ,
    v_payload -> 'declined' -> 'by',
    (v_payload #>> '{viewed,when}')::TIMESTAMPTZ,
    CASE WHEN v_payload #>> '{viewed,total_views}' ~ '^\d+$'
      THEN (v_payload #>> '{viewed,total_views}')::INTEGER END,
    v_payload -> 'viewed' -> 'by',
    v_payload #>> '{question,text}',
    (v_payload #>> '{question,when}')::TIMESTAMPTZ,
    v_payload -> 'question' -> 'by'
  )
  ON CONFLICT (quotient_quote_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.quote_status,
    currency = EXCLUDED.currency,
    title = EXCLUDED.title,
    raw_payload = EXCLUDED.raw_payload,
    last_event_name = EXCLUDED.last_event_name,
    journey_outcome = CASE
      WHEN EXCLUDED.journey_outcome = 'completed' THEN 'completed'
      WHEN EXCLUDED.journey_outcome = 'declined' THEN 'declined'
      WHEN EXCLUDED.journey_outcome = 'accepted' THEN
        CASE WHEN quotes.journey_outcome IN ('completed', 'declined') THEN quotes.journey_outcome ELSE 'accepted' END
      ELSE COALESCE(quotes.journey_outcome, 'open')
    END,
    quote_url = COALESCE(EXCLUDED.quote_url, quotes.quote_url),
    quote_from = COALESCE(EXCLUDED.quote_from, quotes.quote_from),
    quote_for_label = COALESCE(EXCLUDED.quote_for_label, quotes.quote_for_label),
    first_sent = COALESCE(EXCLUDED.first_sent, quotes.first_sent),
    valid_until = COALESCE(EXCLUDED.valid_until, quotes.valid_until),
    quote_status = COALESCE(EXCLUDED.quote_status, quotes.quote_status),
    progress = COALESCE(EXCLUDED.progress, quotes.progress),
    is_archived = EXCLUDED.is_archived,
    amounts_are = COALESCE(EXCLUDED.amounts_are, quotes.amounts_are),
    overall_discount = COALESCE(EXCLUDED.overall_discount, quotes.overall_discount),
    total_includes_tax = COALESCE(EXCLUDED.total_includes_tax, quotes.total_includes_tax),
    total_excludes_tax = COALESCE(EXCLUDED.total_excludes_tax, quotes.total_excludes_tax),
    discount_amount_includes_tax = COALESCE(EXCLUDED.discount_amount_includes_tax, quotes.discount_amount_includes_tax),
    discount_amount_excludes_tax = COALESCE(EXCLUDED.discount_amount_excludes_tax, quotes.discount_amount_excludes_tax),
    deposit_percent = COALESCE(EXCLUDED.deposit_percent, quotes.deposit_percent),
    deposit_amount_includes_tax = COALESCE(EXCLUDED.deposit_amount_includes_tax, quotes.deposit_amount_includes_tax),
    deposit_amount_excludes_tax = COALESCE(EXCLUDED.deposit_amount_excludes_tax, quotes.deposit_amount_excludes_tax),
    item_headings = COALESCE(EXCLUDED.item_headings, quotes.item_headings),
    quote_for_name_first = COALESCE(EXCLUDED.quote_for_name_first, quotes.quote_for_name_first),
    quote_for_name_last = COALESCE(EXCLUDED.quote_for_name_last, quotes.quote_for_name_last),
    quote_for_email = COALESCE(EXCLUDED.quote_for_email, quotes.quote_for_email),
    quote_for_phone = COALESCE(EXCLUDED.quote_for_phone, quotes.quote_for_phone),
    quote_for_phone_type = COALESCE(EXCLUDED.quote_for_phone_type, quotes.quote_for_phone_type),
    quote_for_street = COALESCE(EXCLUDED.quote_for_street, quotes.quote_for_street),
    quote_for_city = COALESCE(EXCLUDED.quote_for_city, quotes.quote_for_city),
    quote_for_state = COALESCE(EXCLUDED.quote_for_state, quotes.quote_for_state),
    quote_for_zip = COALESCE(EXCLUDED.quote_for_zip, quotes.quote_for_zip),
    quote_for_country = COALESCE(EXCLUDED.quote_for_country, quotes.quote_for_country),
    accepted_order_number = COALESCE(EXCLUDED.accepted_order_number, quotes.accepted_order_number),
    accepted_comments = COALESCE(EXCLUDED.accepted_comments, quotes.accepted_comments),
    accepted_when = COALESCE(EXCLUDED.accepted_when, quotes.accepted_when),
    accepted_on_behalf = COALESCE(EXCLUDED.accepted_on_behalf, quotes.accepted_on_behalf),
    accepted_by = COALESCE(EXCLUDED.accepted_by, quotes.accepted_by),
    declined_comments = COALESCE(EXCLUDED.declined_comments, quotes.declined_comments),
    declined_when = COALESCE(EXCLUDED.declined_when, quotes.declined_when),
    declined_by = COALESCE(EXCLUDED.declined_by, quotes.declined_by),
    viewed_when = COALESCE(EXCLUDED.viewed_when, quotes.viewed_when),
    viewed_total_views = COALESCE(EXCLUDED.viewed_total_views, quotes.viewed_total_views),
    viewed_by = COALESCE(EXCLUDED.viewed_by, quotes.viewed_by),
    last_question_text = COALESCE(EXCLUDED.last_question_text, quotes.last_question_text),
    last_question_when = COALESCE(EXCLUDED.last_question_when, quotes.last_question_when),
    last_question_by = COALESCE(EXCLUDED.last_question_by, quotes.last_question_by),
    updated_at = NOW()
  RETURNING id INTO v_quote_id;

  PERFORM upsert_quote_line_items(v_quote_id, v_payload);

  IF v_event = 'customer_question' THEN
    v_question := COALESCE(
      v_payload #>> '{question,text}',
      CASE WHEN jsonb_typeof(v_payload -> 'question') = 'string' THEN v_payload ->> 'question' END
    );
    IF v_question IS NOT NULL AND btrim(v_question) <> '' THEN
      INSERT INTO quote_questions (quote_id, history_id, question_when, question_text, asked_by)
      VALUES (
        v_quote_id,
        p_row.id,
        COALESCE((v_payload #>> '{question,when}')::TIMESTAMPTZ, p_row.created_at),
        v_question,
        v_payload -> 'question' -> 'by'
      );
      UPDATE jobs
      SET alert_message = 'Customer question: ' || left(v_question, 240), updated_at = NOW()
      WHERE id = v_job_id;
    END IF;
  END IF;

  IF v_event = 'quote_accepted' THEN
    v_search := extract_quotient_search_text(v_payload);
    SELECT * INTO v_specs FROM parse_shop_floor_specs(v_search);

    INSERT INTO jobs (
      id, quote_id, workflow_status, date_raised, due_date, raised_by,
      customer_name, project_name, delivery_instructions,
      construction_type, product_category, mesh_size, thickness_mm,
      resin_type, finish_type, colour, nosing_colour,
      transport_company, client_contact_name, manual_instructions
    )
    VALUES (
      v_job_id,
      v_quote_id,
      'Pending',
      COALESCE((v_payload ->> 'first_sent')::DATE, CURRENT_DATE),
      COALESCE((v_payload ->> 'valid_until')::DATE, CURRENT_DATE + 21),
      COALESCE(v_payload ->> 'from', 'Quotient'),
      COALESCE(v_payload #>> '{quote_for,company_name}', v_payload ->> 'for', 'Unknown'),
      COALESCE(v_payload ->> 'title', 'Quotient program'),
      v_payload #>> '{accepted,comments}',
      v_specs.construction_type,
      v_specs.product_category,
      v_specs.mesh_size,
      v_specs.thickness_mm,
      v_specs.resin_type,
      v_specs.finish_type,
      v_specs.colour,
      v_specs.nosing_colour,
      NULLIF(v_payload ->> 'transport', ''),
      NULLIF(v_contact, ''),
      v_payload #>> '{accepted,comments}'
    )
    ON CONFLICT (id) DO UPDATE SET
      quote_id = EXCLUDED.quote_id,
      customer_name = EXCLUDED.customer_name,
      project_name = EXCLUDED.project_name,
      delivery_instructions = EXCLUDED.delivery_instructions,
      construction_type = EXCLUDED.construction_type,
      product_category = EXCLUDED.product_category,
      mesh_size = EXCLUDED.mesh_size,
      thickness_mm = EXCLUDED.thickness_mm,
      resin_type = EXCLUDED.resin_type,
      finish_type = EXCLUDED.finish_type,
      colour = EXCLUDED.colour,
      nosing_colour = EXCLUDED.nosing_colour,
      client_contact_name = COALESCE(EXCLUDED.client_contact_name, jobs.client_contact_name),
      manual_instructions = COALESCE(EXCLUDED.manual_instructions, jobs.manual_instructions),
      updated_at = NOW();

    DELETE FROM job_materials WHERE job_id = v_job_id;
    DELETE FROM job_labor WHERE job_id = v_job_id;

    v_mat_sl := 0;
    v_lab_sl := 0;

    FOR v_item IN
      SELECT value FROM jsonb_array_elements(COALESCE(v_payload -> 'selected_items', '[]'::JSONB))
    LOOP
      v_desc := lower(
        COALESCE(v_item ->> 'heading', '') || ' ' ||
        COALESCE(v_item ->> 'description', '') || ' ' ||
        COALESCE(v_item ->> 'item_code', '')
      );

      v_qty := (v_item ->> 'quantity')::NUMERIC;
      IF v_qty IS NULL OR v_qty <= 0 THEN v_qty := 1; END IF;

      v_is_labor := (
        COALESCE(v_item ->> 'item_code', '') ILIKE 'LAB%'
        OR COALESCE(v_item ->> 'sales_category', '') ILIKE '%billing%'
        OR v_desc ~ '(labou?r|lay-?up|install|hourly|shop\s*floor|machining)'
      );

      IF v_is_labor THEN
        v_lab_sl := v_lab_sl + 1;
        INSERT INTO job_labor (job_id, sl_no, labor_category, description, hours_estimated, rate_aud, line_total)
        VALUES (
          v_job_id, v_lab_sl,
          CASE
            WHEN v_desc ~ 'qa|inspect' THEN 'QA Inspection'
            WHEN v_desc ~ 'install' THEN 'Install'
            WHEN v_desc ~ 'mould|mold' THEN 'Moulding'
            WHEN v_desc ~ 'pultrud' THEN 'Pultrusion'
            WHEN v_desc ~ 'pack|dispatch' THEN 'Pack & Dispatch'
            ELSE 'Lay-up'
          END,
          trim(both ' ' from COALESCE(v_item ->> 'heading', 'Labour') || ' — ' || COALESCE(v_item ->> 'description', '')),
          v_qty,
          (v_item ->> 'unit_price')::NUMERIC,
          (v_item ->> 'item_total')::NUMERIC
        );
      ELSE
        v_mat_sl := v_mat_sl + 1;
        IF v_desc ~ 'clip' THEN v_section := 'Clips';
        ELSIF v_desc ~ 'fastener|bolt|washer|nut' THEN v_section := 'Fasteners';
        ELSIF v_desc ~ 'grat|tread|nosing' THEN v_section := 'Grating_Treads';
        ELSIF COALESCE(v_item ->> 'sales_category', '') ILIKE '%consumable%' THEN v_section := 'Consumable';
        ELSE v_section := 'Raw_Material';
        END IF;

        INSERT INTO job_materials (
          job_id, sl_no, section, item_description, item_code, qty, unit_price, line_total,
          resin, mesh, thickness, colour, finish
        ) VALUES (
          v_job_id, v_mat_sl, v_section,
          trim(both ' ' from COALESCE(v_item ->> 'heading', '') || ' — ' || COALESCE(v_item ->> 'description', '')),
          v_item ->> 'item_code',
          v_qty,
          (v_item ->> 'unit_price')::NUMERIC,
          (v_item ->> 'item_total')::NUMERIC,
          v_specs.resin_type, v_specs.mesh_size, v_specs.thickness_mm, v_specs.colour, v_specs.finish_type
        );
      END IF;
    END LOOP;

    IF v_mat_sl = 0 THEN
      INSERT INTO job_materials (job_id, sl_no, section, item_description, resin, mesh, thickness, colour, finish)
      VALUES (v_job_id, 1, 'Other', COALESCE(v_payload ->> 'title', 'Accepted quote scope'),
        v_specs.resin_type, v_specs.mesh_size, v_specs.thickness_mm, v_specs.colour, v_specs.finish_type);
    END IF;

    IF v_lab_sl = 0 THEN
      INSERT INTO job_labor (job_id, sl_no, labor_category, description, hours_estimated)
      VALUES
        (v_job_id, 1, 'Lay-up', 'Panel lay-up per accepted quote', 8),
        (v_job_id, 2, 'QA Inspection', 'Dimensional and cure verification', 1.5);
    END IF;

  ELSIF v_event = 'quote_completed' THEN
    UPDATE jobs SET workflow_status = 'Complete', updated_at = NOW() WHERE id = v_job_id;
    UPDATE quotes SET quote_status = 'Completed', progress = COALESCE(v_payload ->> 'progress', 'Complete'), updated_at = NOW()
    WHERE id = v_quote_id;

  ELSIF v_event = 'quote_declined' THEN
    UPDATE jobs SET workflow_status = 'Cancelled', updated_at = NOW() WHERE id = v_job_id;
    UPDATE jobs SET alert_message = 'Quote declined: ' || left(COALESCE(v_payload #>> '{declined,comments}', 'No reason given'), 220), updated_at = NOW()
    WHERE id = v_job_id AND v_payload #>> '{declined,comments}' IS NOT NULL;
  END IF;

  UPDATE quotes SET factory_job_status = (
    SELECT workflow_status FROM jobs WHERE id = v_job_id LIMIT 1
  )
  WHERE id = v_quote_id;

  UPDATE quote_events_history
  SET processing_status = 'processed', processing_error = NULL
  WHERE id = p_row.id;

EXCEPTION WHEN OTHERS THEN
  UPDATE quote_events_history
  SET processing_status = 'failed', processing_error = SQLERRM
  WHERE id = p_row.id;
END;
$$;

-- Backfill question thread from existing history
CREATE OR REPLACE FUNCTION public.backfill_quote_questions_from_history()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO quote_questions (quote_id, history_id, question_when, question_text, asked_by)
  SELECT
    q.id,
    h.id,
    COALESCE((h.raw_payload #>> '{question,when}')::TIMESTAMPTZ, h.created_at),
    COALESCE(
      h.raw_payload #>> '{question,text}',
      CASE WHEN jsonb_typeof(h.raw_payload -> 'question') = 'string' THEN h.raw_payload ->> 'question' END
    ),
    h.raw_payload -> 'question' -> 'by'
  FROM quote_events_history h
  JOIN quotes q ON q.quotient_quote_id = h.quotient_id
  WHERE h.event_name = 'customer_question'
    AND NOT EXISTS (
      SELECT 1 FROM quote_questions qq WHERE qq.history_id = h.id
    )
    AND COALESCE(
      h.raw_payload #>> '{question,text}',
      CASE WHEN jsonb_typeof(h.raw_payload -> 'question') = 'string' THEN h.raw_payload ->> 'question' END,
      ''
    ) <> '';
END;
$$;

SELECT public.backfill_quote_questions_from_history();
DROP FUNCTION IF EXISTS public.backfill_quote_questions_from_history();

-- Backfill line items from latest raw_payload per quote
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, raw_payload FROM quotes WHERE raw_payload IS NOT NULL AND raw_payload <> '{}'::JSONB
  LOOP
    PERFORM upsert_quote_line_items(r.id, r.raw_payload);
  END LOOP;
END;
$$;
