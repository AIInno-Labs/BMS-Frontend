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
    const [jobRes, auditRes] = await Promise.all([
      fetch(`${base}/jobs/${encodeURIComponent(decoded)}`, {
        headers: auth ? { Authorization: auth } : {},
        cache: "no-store",
      }),
      fetch(`${base}/jobs/${encodeURIComponent(decoded)}/audit?page=0&size=1`, {
        headers: auth ? { Authorization: auth } : {},
        cache: "no-store",
      }),
    ]);
    if (!jobRes.ok) {
      const message =
        jobRes.status === 404
          ? "Job not found"
          : `Backend error (${jobRes.status})`;
      return NextResponse.json({ error: message }, { status: jobRes.status });
    }
    const dto = (await jobRes.json()) as FrpJobDTO;
    const auditPage = auditRes.ok
      ? ((await auditRes.json()) as { totalElements?: number })
      : null;
    const job = frpJobToUi(dto);
    const data = buildOfficialJobCardData(job, undefined, auditPage?.totalElements ?? 0);
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
