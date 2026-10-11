-- Directors who may appear in "Raised by" on job cards (ERP reference data).
-- Safe to run on existing databases (idempotent).

CREATE TABLE IF NOT EXISTS public.directors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT directors_display_name_unique UNIQUE (display_name)
);

CREATE INDEX IF NOT EXISTS idx_directors_active_sort
  ON public.directors (is_active, sort_order, display_name);

COMMENT ON TABLE public.directors IS 'Reference list for jobs.raised_by — company directors / signatories';

-- Seed canonical directors (upsert by display_name)
INSERT INTO public.directors (display_name, sort_order, is_active)
VALUES
  ('Dirk B', 10, TRUE),
  ('Steve B', 20, TRUE),
  ('Hugh', 30, TRUE),
  ('Dave', 40, TRUE)
ON CONFLICT (display_name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

ALTER TABLE public.directors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "directors_read_authenticated" ON public.directors;
CREATE POLICY "directors_read_authenticated" ON public.directors
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "directors_read_anon" ON public.directors;
CREATE POLICY "directors_read_anon" ON public.directors
  FOR SELECT TO anon
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "directors_service_role_all" ON public.directors;
CREATE POLICY "directors_service_role_all" ON public.directors
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Optional: keep jobs.raised_by aligned with director names (no FK — migration-safe TEXT column).
COMMENT ON COLUMN public.jobs.raised_by IS 'Director display name; should match public.directors.display_name when set via app';
