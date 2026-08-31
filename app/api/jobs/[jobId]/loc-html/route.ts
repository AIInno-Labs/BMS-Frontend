import { NextResponse } from "next/server";
import { buildOfficialLocData, formatWorkshopAddress } from "@/lib/buildLocData";
import { buildLocPrintHtml } from "@/lib/locPrintHtml";
import {
  frpJobToUi,
  getQcSignoff,
  type FrpJobAuditHistoryDTO,
  type FrpJobDTO,
} from "@/lib/frp/job-mapper";
import type { UserDTO } from "@/lib/frp/types";

interface RouteContext {
  /**
   * Spring Boot job primary key, not the job number — `GET /jobs/{id}` takes a
   * numeric `@PathVariable Long`, so `JOB-1001` is a 400.
   */
  params: Promise<{ jobId: string }>;
}

/**
 * Print HTML for a Letter of Compliance, fetched from Spring Boot with the
 * caller's Bearer token forwarded from the browser. Mirrors
 * `app/api/jobs/[jobId]/job-card-html/route.ts`.
 *
 * The workshop address comes from `GET /auth/me`'s organization. The
 * confirming name and manufacture date both come from the job's own audit
 * log — the `STAGE_COMPLETED`/`qc` row — not from whoever happens to be
 * exporting the PDF.
 *
 * Never blocks: whatever is missing renders as "—" with a warning banner
 * baked into the document (`data.warningBanner`), and the same text is
 * echoed back in the `X-Loc-Warning` header so the job page can show it too.
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
  const authHeaders: Record<string, string> = auth ? { Authorization: auth } : {};

  try {
    const [jobRes, meRes, auditRes] = await Promise.all([
      fetch(`${base}/jobs/${encodeURIComponent(decoded)}`, {
        headers: authHeaders,
        cache: "no-store",
      }),
      fetch(`${base}/auth/me`, {
        headers: authHeaders,
        cache: "no-store",
      }),
      // Newest first (the endpoint's own order) — size 100 to comfortably
      // cover the qc completion row on a job with heavy audit activity
      // since. Same "just get everything" convention as getJobAuditTrail.
      fetch(`${base}/jobs/${encodeURIComponent(decoded)}/audit?page=0&size=100`, {
        headers: authHeaders,
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
    const me = meRes.ok ? ((await meRes.json()) as UserDTO) : null;
    const auditPage = auditRes.ok
      ? ((await auditRes.json()) as { content?: FrpJobAuditHistoryDTO[] })
      : null;

    const job = frpJobToUi(dto);
    const data = buildOfficialLocData(job, {
      qcSignoff: getQcSignoff(auditPage?.content),
      workshopAddress: me?.organization ? formatWorkshopAddress(me.organization) : "",
    });

    const html = buildLocPrintHtml(data, { autoprint });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...(data.warningBanner
          ? { "X-Loc-Warning": encodeURIComponent(data.warningBanner) }
          : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
