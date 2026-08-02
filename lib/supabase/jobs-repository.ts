import { createSupabaseAdmin } from "@/lib/supabase/server";
import { dbRowToJob, jobToDbUpdate, type DbJobRow } from "@/lib/supabase/job-mapper";
import { insertJobAuditEntry } from "@/lib/supabase/job-audit-repository";
import type { Job } from "@/lib/types";

const JOB_SELECT = `
  id,
  quote_id,
  workflow_status,
  priority,
  date_raised,
  due_date,
  quote_valid_until,
  raised_by,
  assigned_worker_name,
  customer_name,
  project_name,
  transport_company,
  freight_account_number,
  consignment_note_number,
  despatch_date,
  delivery_docket_number,
  delivery_instructions,
  pack_dimensions,
  construction_type,
  product_category,
  mesh_size,
  thickness_mm,
  resin_type,
  finish_type,
  colour,
  nosing_colour,
  estimated_hours,
  alert_message,
  manual_instructions,
  client_contact_name,
  manufacturing_required,
  install_required,
  qa_completed,
  created_at
`;

export async function listJobsFromDb(): Promise<Job[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data as DbJobRow[]).map(dbRowToJob);
}

export async function getJobByNumberFromDb(jobNumber: string): Promise<Job | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", jobNumber)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return dbRowToJob(data as DbJobRow);
}

export type JobUpdateAuditAction =
  | false
  | "job_card_saved"
  | "alert_cleared"
  | "ai_estimate"
  | "payment_updated";

export async function updateJobInDb(
  job: Job,
  audit: JobUpdateAuditAction = "job_card_saved",
  auditDetail?: string | null
): Promise<Job> {
  const supabase = createSupabaseAdmin();
  const existing = await getJobByNumberFromDb(job.id);
  const payload = jobToDbUpdate(job);

  const { data, error } = await supabase
    .from("jobs")
    .update(payload)
    .eq("id", job.id)
    .select(JOB_SELECT)
    .single();

  if (error) throw new Error(error.message);
  const saved = dbRowToJob(data as DbJobRow);

  if (audit !== false) {
    try {
      const hadAlert = Boolean(existing?.alert?.trim());
      const hasAlert = Boolean(job.alert?.trim());
      const action =
        audit === "job_card_saved" && hadAlert && !hasAlert
          ? "alert_cleared"
          : audit;
      await insertJobAuditEntry(job.id, action, auditDetail);
    } catch (auditErr) {
      console.warn("[jobs] audit log insert skipped:", auditErr);
    }
  }

  return saved;
}
