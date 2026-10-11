-- Program requirements, contact, and manual instructions on job cards
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS manufacturing_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS install_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qa_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_instructions TEXT,
  ADD COLUMN IF NOT EXISTS client_contact_name TEXT;
