import { NextResponse } from "next/server";
import { buildOfficialJobCardData } from "@/lib/jobCardPrint";
import { buildJobCardPrintHtml } from "@/lib/jobCardPrintHtml";
import { frpJobToUi, type FrpJobDTO } from "@/lib/frp/job-mapper";

interface RouteContext {
  params: Promise<{ jobNumber: string }>;
}

/**
 * Print HTML for a job card. Fetches the job from Spring Boot using the
 * caller's Bearer token (forwarded from the browser).
 */
export async function GET(request: Request, context: RouteContext) {
  const { jobNumber } = await context.params;
  const decoded = decodeURIComponent(jobNumber);
  const autoprint =
    new URL(request.url).searchParams.get("autoprint") === "1";

  const base =
    process.env.NEXT_PUBLIC_FRP_API_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:8080/api/v1";
  const auth = request.headers.get("authorization");

  try {
    const res = await fetch(`${base}/jobs/${encodeURIComponent(decoded)}`, {
      headers: auth ? { Authorization: auth } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      const message =
        res.status === 404
          ? "Job not found"
          : `Backend error (${res.status})`;
      return NextResponse.json({ error: message }, { status: res.status });
    }
    const dto = (await res.json()) as FrpJobDTO;
    const job = frpJobToUi(dto);
    const data = buildOfficialJobCardData(job);
    const html = buildJobCardPrintHtml(data, { autoprint });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
