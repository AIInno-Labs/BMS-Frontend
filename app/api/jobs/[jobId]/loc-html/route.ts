import { NextResponse } from "next/server";
import { buildOfficialLocData, formatWorkshopAddress } from "@/lib/buildLocData";
import { buildLocPrintHtml } from "@/lib/locPrintHtml";
import { frpJobToUi, getQcSignoff, type FrpJobDTO } from "@/lib/frp/job-mapper";
import type { PageResponse, UserDTO } from "@/lib/frp/types";

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
 * manufacture date comes from the job's own `qc` stage tree — the `signoff`
 * operation's `completedAt`. The confirming name is that same operation's
 * `lastModifiedBy` (a raw user id), resolved to a display name via the
 * existing `GET /users` endpoint — the same one `listUsers` already uses
 * elsewhere in the app (e.g. the "Responsible party" picker) — not a new
 * backend endpoint, and not whoever happens to be exporting the PDF.
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
    const [jobRes, meRes, usersRes] = await Promise.all([
      fetch(`${base}/jobs/${encodeURIComponent(decoded)}`, {
        headers: authHeaders,
        cache: "no-store",
      }),
      fetch(`${base}/auth/me`, {
        headers: authHeaders,
        cache: "no-store",
      }),
      // Same "list every org user" call listUsers() already makes for the
      // Responsible-party picker — just resolving one more id from it.
      fetch(`${base}/users?page=0&size=200`, {
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
    const usersPage = usersRes.ok
      ? ((await usersRes.json()) as PageResponse<UserDTO>)
      : null;
    const usersById: Record<number, string> = {};
    for (const u of usersPage?.content ?? []) {
      if (u.id != null && u.displayName) usersById[u.id] = u.displayName;
    }

    const job = frpJobToUi(dto);
    const data = buildOfficialLocData(job, {
      qcSignoff: getQcSignoff(dto.stages, usersById),
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
