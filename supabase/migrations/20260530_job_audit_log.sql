-- Job card activity log (manager saves, alert cleared, etc.)

CREATE TABLE IF NOT EXISTS public.job_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_audit_log_job_id
  ON public.job_audit_log (job_id, created_at ASC);

ALTER TABLE public.job_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_audit_log_read_authenticated" ON public.job_audit_log;
CREATE POLICY "job_audit_log_read_authenticated" ON public.job_audit_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "job_audit_log_service_all" ON public.job_audit_log;
CREATE POLICY "job_audit_log_service_all" ON public.job_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.job_audit_log IS 'Append-only job card actions (saves, alert cleared) for Activity Audit Trail';
