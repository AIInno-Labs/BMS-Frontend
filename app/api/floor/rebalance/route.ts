import { NextResponse } from "next/server";
import { rebalanceFloorAssignments } from "@/lib/supabase/floor-repository";
import { listStaffFromDb } from "@/lib/supabase/floor-repository";

export async function POST() {
  try {
    const { jobs, reassignedCount } = await rebalanceFloorAssignments();
    const staff = await listStaffFromDb();
    return NextResponse.json({
      ok: true,
      jobs,
      staff,
      reassignedCount,
      message:
        reassignedCount > 0
          ? `Reassigned ${reassignedCount} program${reassignedCount === 1 ? "" : "s"} across the floor.`
          : "Floor load is already balanced — no changes needed.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Floor rebalance failed";
    console.error("[api/floor/rebalance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
