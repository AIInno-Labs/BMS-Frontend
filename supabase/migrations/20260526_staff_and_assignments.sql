-- Run in Supabase SQL Editor if you already applied schema.sql without staff / assignments.

CREATE TABLE IF NOT EXISTS public.staff (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE,
  initials TEXT NOT NULL,
  certifications TEXT[] NOT NULL DEFAULT '{}',
  shift_hours_capacity NUMERIC(10, 2) NOT NULL DEFAULT 8,
  is_present BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS assigned_worker_name TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_worker ON public.jobs (assigned_worker_name);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_authenticated" ON public.staff;
CREATE POLICY "staff_read_authenticated" ON public.staff
  FOR SELECT TO authenticated USING (TRUE);
