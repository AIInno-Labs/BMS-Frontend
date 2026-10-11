import { NextResponse } from "next/server";

import { buildOfficialJobCardData } from "@/lib/jobCardPrint";
import { buildJobCardPrintHtml } from "@/lib/jobCardPrintHtml";
import { getJobByNumberFromDb } from "@/lib/supabase/jobs-repository";

interface RouteContext {
  params: Promise<{ jobNumber: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { jobNumber } = await context.params;
  const decoded = decodeURIComponent(jobNumber);
  const autoprint =
    new URL(request.url).searchParams.get("autoprint") === "1";
  const job = await getJobByNumberFromDb(decoded);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const data = buildOfficialJobCardData(job);
  const html = buildJobCardPrintHtml(data, { autoprint });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
