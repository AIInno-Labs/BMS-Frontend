import { listJobs } from "@/lib/frp/api";
import { frpJobSummaryToUi } from "@/lib/frp/job-mapper";
import type { Job } from "@/lib/types";

/**
 * `GET /jobs` caps `size` at 200 (see listJobs in lib/frp/api.ts — bms-api.yaml
 * sets `maximum: 200`). JobsContext relies on that single capped page as a
 * "most recent jobs" cache and falls back to the org-wide `GET /jobs/counts`
 * for accurate totals, because the list itself under-represents anything
 * past the 200 most recent jobs.
 *
 * The Customers/CRM pages need every job correctly attributed to its
 * customer — including customers whose jobs are older than the 200 most
 * recent — so this pages through the full result set instead of trusting
 * one page. Independent of JobsContext on purpose: this keeps Dashboard,
 * Jobs and Analytics unaffected by the extra requests this makes.
 */
export async function fetchAllJobs(): Promise<Job[]> {
  const first = await listJobs(0, 200, { sort: "RECENT" });
  const totalPages = Math.max(1, first.totalPages ?? 1);

  const restPages =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            listJobs(i + 1, 200, { sort: "RECENT" })
          )
        )
      : [];

  return [first, ...restPages].flatMap((page) =>
    (page.content ?? []).map(frpJobSummaryToUi)
  );
}
