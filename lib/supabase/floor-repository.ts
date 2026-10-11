import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  computeRebalancedAssignments,
  type DbStaffRow,
} from "@/lib/floorOps";
import { dbRowToJob, type DbJobRow } from "@/lib/supabase/job-mapper";
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

export async function listStaffFromDb(): Promise<DbStaffRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, display_name, initials, certifications, shift_hours_capacity, is_present"
    )
    .order("display_name");

  if (error) throw new Error(error.message);
  return (data ?? []) as DbStaffRow[];
}

export async function listJobsForFloor(): Promise<Job[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return (data as DbJobRow[]).map(dbRowToJob);
}

export async function rebalanceFloorAssignments(): Promise<{
  jobs: Job[];
  reassignedCount: number;
}> {
  const staff = await listStaffFromDb();
  const jobs = await listJobsForFloor();
  const updates = computeRebalancedAssignments(staff, jobs);

  if (updates.size === 0) {
    return { jobs, reassignedCount: 0 };
  }

  const supabase = createSupabaseAdmin();

  for (const [jobId, workerName] of updates) {
    const { error } = await supabase
      .from("jobs")
      .update({ assigned_worker_name: workerName })
      .eq("id", jobId);

    if (error) throw new Error(`Rebalance ${jobId}: ${error.message}`);
  }

  const refreshed = await listJobsForFloor();
  return { jobs: refreshed, reassignedCount: updates.size };
}
