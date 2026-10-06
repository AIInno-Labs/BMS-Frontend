import { NextResponse } from "next/server";
import { emptyAnalyticsSnapshot } from "@/lib/analytics/types";

export async function GET() {
  return NextResponse.json(emptyAnalyticsSnapshot());
}
