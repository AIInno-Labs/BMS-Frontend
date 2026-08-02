-- Native PostgreSQL webhook pipeline (replaces Inngest / RPC-only Phase 2)
-- Run in Supabase SQL Editor on existing projects.

DROP TRIGGER IF EXISTS trg_quotient_webhook_process ON public.quote_events_history;
DROP FUNCTION IF EXISTS public.process_quotient_webhook_payload() CASCADE;
DROP FUNCTION IF EXISTS public.process_quotient_history_row(public.quote_events_history) CASCADE;
DROP FUNCTION IF EXISTS public.parse_shop_floor_specs(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.extract_quotient_search_text(JSONB) CASCADE;

-- ---------------------------------------------------------------------------
-- Extract searchable text from Quotient JSONB (mirrors lib/quotient/specParser.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extract_quotient_search_text(p JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts TEXT[] := ARRAY[]::TEXT[];
  v_item JSONB;
BEGIN
  IF COALESCE(p ->> 'title', '') <> '' THEN
    parts := array_append(parts, p ->> 'title');
  END IF;
  IF COALESCE(p ->> 'item_headings', '') <> '' THEN
    parts := array_append(parts, p ->> 'item_headings');
  END IF;
  IF COALESCE(p ->> 'for', '') <> '' THEN
    parts := array_append(parts, p ->> 'for');
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p -> 'selected_items', '[]'::JSONB))
  LOOP
    IF COALESCE(v_item ->> 'heading', '') <> '' THEN
      parts := array_append(parts, v_item ->> 'heading');
    END IF;
    IF COALESCE(v_item ->> 'description', '') <> '' THEN
      parts := array_append(parts, v_item ->> 'description');
    END IF;
    IF COALESCE(v_item ->> 'item_code', '') <> '' THEN
      parts := array_append(parts, v_item ->> 'item_code');
    END IF;
  END LOOP;

  RETURN array_to_string(parts, E'\n');
END;
$$;

-- ---------------------------------------------------------------------------
-- Regex / keyword shop-floor spec mapping
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_shop_floor_specs(search_text TEXT)
RETURNS TABLE (
  construction_type TEXT,
  product_category TEXT,
  mesh_size TEXT,
  thickness_mm TEXT,
  resin_type TEXT,
  finish_type TEXT,
  colour TEXT,
  nosing_colour TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t TEXT := COALESCE(search_text, '');
  grit_m TEXT[];
BEGIN
  construction_type := NULL;
  IF t ~* 'pultrud' THEN
    construction_type := 'Pultruded';
  ELSIF t ~* 'moulded|molded' THEN
    construction_type := 'Moulded';
  END IF;

  product_category := NULL;
  IF t ~* 'grating|grate' THEN
    product_category := 'Grating';
  ELSIF t ~* 'tread|stair' THEN
    product_category := 'Tread';
  END IF;

  mesh_size := NULL;
  IF t ~* '38\s*[x/]\s*38' THEN mesh_size := '38x38';
  ELSIF t ~* '50\s*[x/]\s*50' THEN mesh_size := '50x50';
  ELSIF t ~* '38\s*/\s*19\s*sq' THEN mesh_size := '38/19 sq';
  ELSIF t ~* '40\s*/\s*20\s*sq' THEN mesh_size := '40/20 sq';
  ELSIF t ~* '38\s*/\s*12\.?5\s*sq' THEN mesh_size := '38x12.5 sq';
  ELSIF t ~* '40\s*/\s*13\s*sq' THEN mesh_size := '40x13 sq';
  END IF;

  thickness_mm := NULL;
  IF t ~* '\m(15|20|22|25|30|32|38|40|50)\s*mm\M' THEN
    thickness_mm := (regexp_match(t, '\m(15|20|22|25|30|32|38|40|50)\s*mm\M', 'i'))[1];
  ELSIF t ~* '\m(15|20|22|25|30|32|38|40|50)\s*thick\M' THEN
    thickness_mm := (regexp_match(t, '\m(15|20|22|25|30|32|38|40|50)\s*thick\M', 'i'))[1];
  END IF;

  resin_type := NULL;
  IF t ~* '\mVEFR\M' OR t ~* '\mVE\s*FR\M' THEN resin_type := 'VEFR';
  ELSIF t ~* 'vinyl\s*ester' THEN resin_type := 'VE';
  ELSIF t ~* '\mIFR\M' THEN resin_type := 'IFR';
  ELSIF t ~* 'isophthalic' THEN resin_type := 'I';
  ELSIF t ~* '\mIsoFR\M' OR t ~* '\mIso\s*FR\M' THEN resin_type := 'OFR';
  ELSIF t ~* 'phenolic|\mPhen\M' THEN resin_type := 'Phen';
  END IF;

  finish_type := NULL;
  grit_m := regexp_match(t, 'grit\s*#?\s*([1-9])', 'i');
  IF grit_m IS NOT NULL THEN
    finish_type := 'Grit #' || grit_m[1];
  ELSIF t ~* 'sand\s*finish|sanded' THEN
    finish_type := 'Sand';
  END IF;

  colour := NULL;
  IF t ~* 'charcoal' THEN colour := 'Charcoal';
  ELSIF t ~* 'safety\s*yellow|yellow\s*grating' THEN colour := 'Yellow';
  ELSIF t ~* '\mgreen\M' THEN colour := 'Green';
  ELSIF t ~* 'concrete\s*grey|concrete' THEN colour := 'Concrete';
  ELSIF t ~* '\mblue\M' THEN colour := 'Blue';
  ELSIF t ~* '\mred\M' THEN colour := 'Red';
  ELSIF t ~* 'light\s*grey' THEN colour := 'Light Grey';
  ELSIF t ~* 'dark\s*grey|\mgrey\M|\mgray\M' THEN colour := 'Dark Grey';
  ELSIF t ~* 'transparent' THEN colour := 'Transparent';
  END IF;

  nosing_colour := NULL;
  IF t ~* 'yellow\s*nosing|nosing\s*yellow|grit\s*nosing' THEN
    nosing_colour := 'Yellow';
  ELSIF t ~* 'black\s*nosing|nosing\s*black' THEN
    nosing_colour := 'Black';
  END IF;

  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Core row processor (all event types; full transform on quote_accepted)
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
BEGIN
  v_payload := p_row.raw_payload;
  v_event := p_row.event_name;
  v_quotient_id := p_row.quotient_id;
  v_job_id := 'JOB-Q-' || v_quotient_id;

  UPDATE quote_events_history
  SET processing_status = 'processing', processing_error = NULL
  WHERE id = p_row.id;

  INSERT INTO quotes (quotient_quote_id, customer_name, total_amount, status, currency, title, raw_payload)
  VALUES (
    v_quotient_id,
    COALESCE(v_payload #>> '{quote_for,company_name}', v_payload ->> 'for', 'Unknown Customer'),
    COALESCE((v_payload ->> 'total_includes_tax')::NUMERIC, (v_payload ->> 'total_excludes_tax')::NUMERIC),
    COALESCE(v_payload ->> 'quote_status', 'Unknown'),
    COALESCE(v_payload ->> 'currency', 'AUD'),
    v_payload ->> 'title',
    v_payload
  )
  ON CONFLICT (quotient_quote_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    total_amount = EXCLUDED.total_amount,
    status = EXCLUDED.status,
    title = EXCLUDED.title,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW()
  RETURNING id INTO v_quote_id;

  IF v_event = 'quote_accepted' THEN
    v_search := extract_quotient_search_text(v_payload);
    SELECT * INTO v_specs FROM parse_shop_floor_specs(v_search);

    INSERT INTO jobs (
      id, quote_id, workflow_status, date_raised, due_date, raised_by,
      customer_name, project_name, delivery_instructions,
      construction_type, product_category, mesh_size, thickness_mm,
      resin_type, finish_type, colour, nosing_colour,
      transport_company
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
      COALESCE(v_payload ->> 'transport', v_payload #>> '{quote_for,company_name}')
    )
    ON CONFLICT (id) DO UPDATE SET
      quote_id = EXCLUDED.quote_id,
      workflow_status = 'Pending',
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
      transport_company = EXCLUDED.transport_company,
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

      v_is_labor := (
        COALESCE(v_item ->> 'item_code', '') ILIKE 'LAB%'
        OR COALESCE(v_item ->> 'sales_category', '') ILIKE '%billing%'
        OR v_desc ~ '(labou?r|lay-?up|install|hourly|shop\s*floor|machining)'
      );

      IF v_is_labor THEN
        v_lab_sl := v_lab_sl + 1;
        INSERT INTO job_labor (job_id, sl_no, labor_category, description, hours_estimated, rate_aud, line_total)
        VALUES (
          v_job_id,
          v_lab_sl,
          CASE
            WHEN v_desc ~ 'qa|inspect' THEN 'QA Inspection'
            WHEN v_desc ~ 'install' THEN 'Install'
            WHEN v_desc ~ 'mould|mold' THEN 'Moulding'
            WHEN v_desc ~ 'pultrud' THEN 'Pultrusion'
            WHEN v_desc ~ 'pack|dispatch' THEN 'Pack & Dispatch'
            ELSE 'Lay-up'
          END,
          trim(both ' ' from COALESCE(v_item ->> 'heading', 'Labour') || ' — ' || COALESCE(v_item ->> 'description', '')),
          COALESCE((v_item ->> 'quantity')::NUMERIC, 1),
          (v_item ->> 'unit_price')::NUMERIC,
          (v_item ->> 'item_total')::NUMERIC
        );
      ELSE
        v_mat_sl := v_mat_sl + 1;

        IF v_desc ~ 'clip' THEN
          v_section := 'Clips';
        ELSIF v_desc ~ 'fastener|bolt|washer|nut' THEN
          v_section := 'Fasteners';
        ELSIF v_desc ~ 'grat|tread|nosing' THEN
          v_section := 'Grating_Treads';
        ELSIF COALESCE(v_item ->> 'sales_category', '') ILIKE '%consumable%' THEN
          v_section := 'Consumable';
        ELSE
          v_section := 'Raw_Material';
        END IF;

        INSERT INTO job_materials (
          job_id, sl_no, section, item_description, item_code, qty, unit_price, line_total,
          resin, mesh, thickness, colour, finish
        )
        VALUES (
          v_job_id,
          v_mat_sl,
          v_section,
          trim(both ' ' from COALESCE(v_item ->> 'heading', '') || ' — ' || COALESCE(v_item ->> 'description', '')),
          v_item ->> 'item_code',
          COALESCE((v_item ->> 'quantity')::NUMERIC, 1),
          (v_item ->> 'unit_price')::NUMERIC,
          (v_item ->> 'item_total')::NUMERIC,
          v_specs.resin_type,
          v_specs.mesh_size,
          v_specs.thickness_mm,
          v_specs.colour,
          v_specs.finish_type
        );
      END IF;
    END LOOP;

    IF v_mat_sl = 0 THEN
      INSERT INTO job_materials (job_id, sl_no, section, item_description, resin, mesh, thickness, colour, finish)
      VALUES (
        v_job_id, 1, 'Other',
        COALESCE(v_payload ->> 'title', 'Accepted quote scope'),
        v_specs.resin_type, v_specs.mesh_size, v_specs.thickness_mm, v_specs.colour, v_specs.finish_type
      );
    END IF;

    IF v_lab_sl = 0 THEN
      INSERT INTO job_labor (job_id, sl_no, labor_category, description, hours_estimated)
      VALUES
        (v_job_id, 1, 'Lay-up', 'Panel lay-up per accepted quote', 8),
        (v_job_id, 2, 'QA Inspection', 'Dimensional and cure verification', 1.5);
    END IF;

  ELSIF v_event = 'quote_completed' THEN
    UPDATE jobs SET workflow_status = 'Complete', updated_at = NOW()
    WHERE id = v_job_id;

  ELSIF v_event = 'quote_declined' THEN
    UPDATE jobs SET workflow_status = 'Cancelled', updated_at = NOW()
    WHERE id = v_job_id;

  ELSIF v_event = 'customer_question' THEN
    v_question := COALESCE(
      v_payload #>> '{question,text}',
      CASE WHEN jsonb_typeof(v_payload -> 'question') = 'string' THEN v_payload ->> 'question' END
    );
    IF v_question IS NOT NULL AND v_question <> '' THEN
      UPDATE jobs
      SET alert_message = 'Customer question: ' || left(v_question, 240), updated_at = NOW()
      WHERE id = v_job_id;
    END IF;
  END IF;

  UPDATE quote_events_history
  SET processing_status = 'processed', processing_error = NULL
  WHERE id = p_row.id;

EXCEPTION WHEN OTHERS THEN
  UPDATE quote_events_history
  SET processing_status = 'failed', processing_error = SQLERRM
  WHERE id = p_row.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- AFTER INSERT trigger (fires on every archived event; full transform on accept)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_quotient_webhook_payload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM process_quotient_history_row(NEW);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quotient_webhook_process
  AFTER INSERT ON public.quote_events_history
  FOR EACH ROW
  EXECUTE FUNCTION public.process_quotient_webhook_payload();

-- Manual replay (optional — same logic as trigger)
CREATE OR REPLACE FUNCTION public.process_quotient_history_record(p_history_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.quote_events_history%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM quote_events_history WHERE id = p_history_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found: %', p_history_id;
  END IF;
  PERFORM process_quotient_history_row(v_row);
  RETURN jsonb_build_object('ok', true, 'history_id', p_history_id, 'event', v_row.event_name);
END;
$$;

COMMENT ON FUNCTION public.process_quotient_webhook_payload IS
  'AFTER INSERT trigger — native Quotient transform (quotes, jobs, materials, labour, regex specs)';
COMMENT ON FUNCTION public.process_quotient_history_record IS
  'Manual replay of trigger logic for a single quote_events_history row';
