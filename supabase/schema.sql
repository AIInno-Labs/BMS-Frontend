-- =============================================================================
-- FRP Engineering — Fresh database blueprint (PostgreSQL / Supabase)
--
-- ⚠️  DESTRUCTIVE: Deletes ALL data in the tables below, then recreates them.
--
-- HOW TO RUN (single script — no migrations needed):
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste this ENTIRE file
--   3. Run
--   4. Locally: npm run db:seed
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- TEARDOWN — drop app tables (legacy + current), functions, triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_quotient_webhook_process ON public.quote_events_history;
DROP TRIGGER IF EXISTS trg_jobs_updated ON public.jobs;
DROP TRIGGER IF EXISTS trg_quotes_updated ON public.quotes;
DROP TRIGGER IF EXISTS trg_inventory_updated ON public.inventory;

DROP TABLE IF EXISTS public.job_labor CASCADE;
DROP TABLE IF EXISTS public.job_materials CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.quote_events_history CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;

-- Legacy tables from earlier schema iterations (safe if absent)
DROP TABLE IF EXISTS public.quote_line_items CASCADE;
DROP TABLE IF EXISTS public.job_schedule CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.staff CASCADE;

DROP FUNCTION IF EXISTS public.process_quotient_webhook_payload() CASCADE;
DROP FUNCTION IF EXISTS public.process_quotient_history_row(public.quote_events_history) CASCADE;
DROP FUNCTION IF EXISTS public.parse_shop_floor_specs(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.extract_quotient_search_text(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.process_quotient_history_record(UUID);
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

-- -----------------------------------------------------------------------------
-- INVENTORY
-- -----------------------------------------------------------------------------
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code TEXT NOT NULL UNIQUE,
  product_group TEXT NOT NULL,
  description_1 TEXT NOT NULL,
  description_2 TEXT,
  description_3 TEXT,
  description_4 TEXT,
  resin_material TEXT NOT NULL DEFAULT 'N/A'
    CHECK (resin_material IN (
      'O', 'OFR', 'I', 'IFR', 'VE', 'VEFR', 'Phen', 'IsoFR', 'MEKP', 'N/A', 'Other'
    )),
  primary_colour TEXT,
  stock_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(14, 3) NOT NULL DEFAULT 0,
  reorder_alert BOOLEAN GENERATED ALWAYS AS (stock_quantity <= reorder_level) STORED,
  unit_of_measure TEXT NOT NULL DEFAULT 'ea',
  location_bin TEXT,
  unit_cost_aud NUMERIC(14, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_product_group ON public.inventory (product_group);
CREATE INDEX idx_inventory_resin_material ON public.inventory (resin_material);
CREATE INDEX idx_inventory_reorder_alert ON public.inventory (reorder_alert)
  WHERE reorder_alert = TRUE;

-- -----------------------------------------------------------------------------
-- QUOTE EVENTS HISTORY (Phase 1 webhook archive)
-- -----------------------------------------------------------------------------
CREATE TABLE public.quote_events_history (
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
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN (
      'received', 'queued', 'processing', 'processed', 'partial', 'failed'
    )),
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_events_history_quotient_id
  ON public.quote_events_history (quotient_id, created_at DESC);
CREATE INDEX idx_quote_events_history_event_name
  ON public.quote_events_history (event_name, created_at DESC);
CREATE INDEX idx_quote_events_history_created_at
  ON public.quote_events_history (created_at DESC);
CREATE INDEX idx_quote_events_history_processing
  ON public.quote_events_history (processing_status, created_at DESC);

-- -----------------------------------------------------------------------------
-- QUOTES
-- -----------------------------------------------------------------------------
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotient_quote_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  total_amount NUMERIC(14, 2),
  status TEXT NOT NULL DEFAULT 'Unknown',
  currency TEXT NOT NULL DEFAULT 'AUD',
  title TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_quotient_id ON public.quotes (quotient_quote_id);
CREATE INDEX idx_quotes_status ON public.quotes (status);
CREATE INDEX idx_quotes_created_at ON public.quotes (created_at DESC);

-- -----------------------------------------------------------------------------
-- STAFF — shop floor fabricators (shift roster)
-- -----------------------------------------------------------------------------
CREATE TABLE public.staff (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE,
  initials TEXT NOT NULL,
  certifications TEXT[] NOT NULL DEFAULT '{}',
  shift_hours_capacity NUMERIC(10, 2) NOT NULL DEFAULT 8,
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- JOBS (physical Job Card — id e.g. JOB-1001)
-- -----------------------------------------------------------------------------
CREATE TABLE public.jobs (
  id TEXT PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes (id) ON DELETE SET NULL,
  workflow_status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (workflow_status IN (
      'Pending',
      'Awaiting Manager Approval',
      'Ready to Manufacture',
      'In Fabrication',
      'On Hold',
      'Complete',
      'Cancelled'
    )),
  priority TEXT NOT NULL DEFAULT 'Normal'
    CHECK (priority IN ('Normal', 'High', 'RUSH')),
  date_raised DATE NOT NULL,
  due_date DATE,
  quote_valid_until DATE,
  raised_by TEXT NOT NULL,
  assigned_worker_name TEXT,
  customer_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  transport_company TEXT,
  freight_account_number TEXT,
  consignment_note_number TEXT,
  despatch_date DATE,
  delivery_docket_number TEXT,
  delivery_instructions TEXT,
  pack_dimensions TEXT,
  construction_type TEXT
    CHECK (construction_type IS NULL OR construction_type IN ('Moulded', 'Pultruded', 'Other')),
  product_category TEXT
    CHECK (product_category IS NULL OR product_category IN ('Grating', 'Tread', 'Other')),
  mesh_size TEXT
    CHECK (mesh_size IS NULL OR mesh_size IN (
      '38x38', '50x50', '38/19 sq', '40/20 sq', '38x12.5 sq', '40x13 sq', 'Other'
    )),
  thickness_mm TEXT
    CHECK (thickness_mm IS NULL OR thickness_mm IN (
      '15', '20', '22', '25', '30', '32', '38', '40', '50', 'Other'
    )),
  resin_type TEXT
    CHECK (resin_type IS NULL OR resin_type IN (
      'O', 'OFR', 'I', 'IFR', 'VE', 'VEFR', 'Phen', 'Other'
    )),
  finish_type TEXT
    CHECK (finish_type IS NULL OR finish_type IN (
      'Grit #1', 'Grit #2', 'Grit #3', 'Grit #4', 'Grit #5',
      'Grit #6', 'Grit #7', 'Grit #8', 'Grit #9', 'Sand', 'Other'
    )),
  colour TEXT
    CHECK (colour IS NULL OR colour IN (
      'Green', 'Yellow', 'Concrete', 'Charcoal', 'Blue', 'Transparent',
      'Red', 'Light Grey', 'Dark Grey', 'Other'
    )),
  nosing_colour TEXT
    CHECK (nosing_colour IS NULL OR nosing_colour IN ('Yellow', 'Black', 'Other')),
  supervisor_signature TEXT,
  signed_at TIMESTAMPTZ,
  alert_message TEXT,
  estimated_hours NUMERIC(10, 2),
  manufacturing_required BOOLEAN NOT NULL DEFAULT TRUE,
  install_required BOOLEAN NOT NULL DEFAULT FALSE,
  qa_completed BOOLEAN NOT NULL DEFAULT FALSE,
  manual_instructions TEXT,
  client_contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_assigned_worker ON public.jobs (assigned_worker_name);
CREATE INDEX idx_jobs_quote_id ON public.jobs (quote_id);
CREATE INDEX idx_jobs_workflow_status ON public.jobs (workflow_status);
CREATE INDEX idx_jobs_job_number ON public.jobs (id);
CREATE INDEX idx_jobs_due_date ON public.jobs (due_date);
CREATE INDEX idx_jobs_created_at ON public.jobs (created_at DESC);
CREATE INDEX idx_jobs_customer ON public.jobs (customer_name);

CREATE TABLE public.job_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_audit_log_job_id ON public.job_audit_log (job_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- JOB MATERIALS & LABOR (sl_no resets per job)
-- -----------------------------------------------------------------------------
CREATE TABLE public.job_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  sl_no INTEGER NOT NULL CHECK (sl_no >= 1),
  section TEXT NOT NULL DEFAULT 'Raw_Material'
    CHECK (section IN (
      'Grating_Treads', 'Clips', 'Fasteners', 'Raw_Material',
      'Consumable', 'Billing', 'Other'
    )),
  item_description TEXT NOT NULL,
  item_code TEXT,
  qty NUMERIC(14, 3),
  unit TEXT,
  unit_price NUMERIC(14, 2),
  line_total NUMERIC(14, 2),
  inventory_id UUID REFERENCES public.inventory (id) ON DELETE SET NULL,
  resin TEXT,
  mesh TEXT,
  thickness TEXT,
  colour TEXT,
  finish TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, sl_no)
);

CREATE INDEX idx_job_materials_job_id ON public.job_materials (job_id, sl_no);
CREATE INDEX idx_job_materials_inventory_id ON public.job_materials (inventory_id);

CREATE TABLE public.job_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  sl_no INTEGER NOT NULL CHECK (sl_no >= 1),
  labor_category TEXT NOT NULL DEFAULT 'Other'
    CHECK (labor_category IN (
      'Lay-up', 'Moulding', 'Pultrusion', 'Trim & Finish',
      'Assembly', 'QA Inspection', 'Pack & Dispatch', 'Install', 'Billing', 'Other'
    )),
  description TEXT NOT NULL,
  hours_estimated NUMERIC(10, 2) NOT NULL DEFAULT 0,
  hours_actual NUMERIC(10, 2),
  rate_aud NUMERIC(10, 2),
  line_total NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, sl_no)
);

CREATE INDEX idx_job_labor_job_id ON public.job_labor (job_id, sl_no);

-- -----------------------------------------------------------------------------
-- Phase 2 — native PostgreSQL transform (AFTER INSERT trigger on history)
-- -----------------------------------------------------------------------------
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
      id, quote_id, workflow_status, date_raised, due_date, quote_valid_until, raised_by,
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
      NULL,
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
      quote_valid_until = COALESCE(EXCLUDED.quote_valid_until, jobs.quote_valid_until),
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

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inventory_updated
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quotes_updated
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_jobs_updated
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_read_authenticated" ON public.inventory
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "quotes_read_authenticated" ON public.quotes
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "jobs_read_authenticated" ON public.jobs
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "job_materials_read_authenticated" ON public.job_materials
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "job_labor_read_authenticated" ON public.job_labor
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "quote_events_history_read_authenticated" ON public.quote_events_history
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "staff_read_authenticated" ON public.staff
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "job_audit_log_read_authenticated" ON public.job_audit_log
  FOR SELECT TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- Done
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.inventory IS 'Stock register — product_group, descriptions 1–4, resin_material, primary_colour';
COMMENT ON TABLE public.quote_events_history IS 'Quotient webhook archive — raw_payload; AFTER INSERT trigger processes rows';
COMMENT ON TABLE public.jobs IS 'Factory Job Card — TEXT id JOB-####, shop floor specification CHECK columns';
COMMENT ON FUNCTION public.process_quotient_webhook_payload IS 'AFTER INSERT trigger — native transform on quote_events_history';
COMMENT ON FUNCTION public.process_quotient_history_record IS 'Manual replay of trigger logic for one history row';
