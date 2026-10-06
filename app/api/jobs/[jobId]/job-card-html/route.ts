import { NextResponse } from "next/server";
import { buildJobCardPrintHtml } from "@/lib/jobCardPrintHtml";
import {
  jobCardExportToOfficial,
  type JobCardExportDTO,
} from "@/lib/frp/job-card-export";

interface RouteContext {
  /**
   * Spring Boot job primary key, not the job number — `GET /jobs/{id}` takes a
   * numeric `@PathVariable Long`, so `JOB-1001` is a 400.
   */
  params: Promise<{ jobId: string }>;
}

/**
 * Print HTML for a job card. Proxies Spring `GET /jobs/{id}/job-card`
 * (assembled `JobCardExportDTO`, records `JOB_CARD_DOWNLOADED`) then fills
 * `pdf.html`.
 */
export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const decoded = decodeURIComponent(jobId);
  const autoprint =
    new URL(request.url).searchParams.get("autoprint") === "1";

  if (!/^\d+$/.test(decoded)) {
    return NextResponse.json(
      {
        error: `Expected a numeric job id, received "${decoded}". This route addresses jobs by database id.`,
      },
      { status: 400 }
    );
  }

  const base =
    process.env.NEXT_PUBLIC_FRP_API_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:8080/api/v1";
  const auth = request.headers.get("authorization");

  try {
    const exportRes = await fetch(
      `${base}/jobs/${encodeURIComponent(decoded)}/job-card`,
      {
        headers: auth ? { Authorization: auth } : {},
        cache: "no-store",
      }
    );
    if (!exportRes.ok) {
      const message =
        exportRes.status === 404
          ? "Job not found"
          : `Backend error (${exportRes.status})`;
      return NextResponse.json({ error: message }, { status: exportRes.status });
    }
    const dto = (await exportRes.json()) as JobCardExportDTO;
    const data = jobCardExportToOfficial(dto);
    const html = buildJobCardPrintHtml(data, { autoprint });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job card";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
