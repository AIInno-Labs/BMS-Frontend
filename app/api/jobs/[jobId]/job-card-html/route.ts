import { NextResponse } from "next/server";
import { buildOfficialJobCardData } from "@/lib/jobCardPrint";
import { buildJobCardPrintHtml } from "@/lib/jobCardPrintHtml";
import { frpJobToUi, type FrpJobDTO } from "@/lib/frp/job-mapper";

interface RouteContext {
  /**
   * Spring Boot job primary key, not the job number — `GET /jobs/{id}` takes a
   * numeric `@PathVariable Long`, so `JOB-1001` is a 400.
   */
  params: Promise<{ jobId: string }>;
}

/**
 * Print HTML for a job card, fetched from Spring Boot with the caller's Bearer
 * token forwarded from the browser.
 *
 * Rev 2 §13 puts this endpoint on the backend (`GET /jobs/{id}/job-card-html`,
 * writing a `JOB_CARD_DOWNLOADED` audit row). Until that ships this proxy
 * stands in — and that audit row is not written.
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
