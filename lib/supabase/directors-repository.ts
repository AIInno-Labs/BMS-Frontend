import { createSupabaseAdmin } from "@/lib/supabase/server";

export interface DirectorRow {
  id: string;
  display_name: string;
  sort_order: number;
  is_active: boolean;
}

export async function listActiveDirectorsFromDb(): Promise<DirectorRow[]> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("directors")
    .select("id, display_name, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    if (error.code === "42P01") {
      console.warn("[directors] table missing — run supabase/migrations/20260603_directors.sql");
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as DirectorRow[];
}
