const JOBS_LIST_RETURN_KEY = "frp.jobsListReturn";

/** Persist the filtered `/jobs?...` URL so "Back to Jobs" can restore it. */
export function rememberJobsListUrl(url: string): void {
  if (typeof window === "undefined") return;
  if (!url.startsWith("/jobs")) return;
  // Job detail paths are `/jobs/123` — only remember the list route.
  if (url !== "/jobs" && !url.startsWith("/jobs?")) return;
  try {
    sessionStorage.setItem(JOBS_LIST_RETURN_KEY, url);
  } catch {
    // private mode / quota — ignore
  }
}

export function getJobsListReturnUrl(): string {
  if (typeof window === "undefined") return "/jobs";
  try {
    const stored = sessionStorage.getItem(JOBS_LIST_RETURN_KEY);
    if (stored && (stored === "/jobs" || stored.startsWith("/jobs?"))) {
      return stored;
    }
  } catch {
    // ignore
  }
  return "/jobs";
}
