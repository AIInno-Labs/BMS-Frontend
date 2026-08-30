"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createJob,
  getJob,
  getJobCounts,
  listJobs,
  listUsers,
  saveContactDetails,
  saveJobCard,
  saveSchedulingLogistics,
  updateJobApi,
  uploadJobDocument,
} from "@/lib/frp/api";
import {
  countsFromDto,
  deriveFromJobs,
  EMPTY_JOB_COUNTS,
  type JobCounts,
} from "@/lib/frp/job-counts";
import {
  frpJobSummaryToUi,
  frpJobToUi,
  type JobUpdateAuditAction,
  schedulingLogisticsToBackend,
  uiJobToContactDetails,
  uiJobToCreateRequest,
  uiJobToJobCardPayload,
  uiJobToUpdateRequest,
} from "@/lib/frp/job-mapper";
import { statusToBackend } from "@/lib/frp/job-status";
import { FrpApiError, type UserDTO } from "@/lib/frp/types";
import type { DbStaffRow } from "@/lib/floorOps";
import { setStaffRoster } from "@/lib/workers";
import type { Job } from "@/lib/types";

export type { JobUpdateAuditAction };

/** Match a route segment to a cached job (job number or database id). */
function jobRouteMatches(job: Job, routeId: string): boolean {
  const id = routeId.trim();
  if (!id) return false;
  if (job.id === id || job.dbId === id) return true;
  const bare = id.replace(/^JOB-/i, "");
  const jobBare = job.id.replace(/^JOB-/i, "");
  return bare !== id && jobBare === bare;
}

/** Resolve Spring Boot job id for GET /jobs/{id} from a route id. */
async function resolveJobDbId(
  routeId: string,
  jobs: Job[]
): Promise<string | null> {
  const id = routeId.trim();
  if (!id) return null;

  const cached = jobs.find((j) => jobRouteMatches(j, id));
  if (cached?.dbId) return cached.dbId;

  if (/^\d+$/.test(id)) return id;

  try {
    const page = await listJobs(0, 20, { search: id });
    const hit = (page.content ?? []).find((row) => {
      const num = row.jobNumber ?? "";
      return (
        num === id ||
        num.replace(/^JOB-/i, "") === id.replace(/^JOB-/i, "") ||
        String(row.id) === id
      );
    });
    if (hit?.id != null) return String(hit.id);
  } catch {
    // Search is best-effort when the job is not in the cached list page.
  }
  return null;
}

export interface DirectorRow {
  id: string;
  name: string;
  display_name: string;
  active?: boolean;
}

interface JobsContextValue {
  jobs: Job[];
  /**
   * Org-wide counts from `GET /jobs/counts` — the single source for every KPI
   * tile, donut and stage card. Counting `jobs` instead counts one page.
   */
  counts: JobCounts;
  staff: DbStaffRow[];
  directors: DirectorRow[];
  directorsLoading: boolean;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  refreshJobs: (options?: { silent?: boolean }) => Promise<Job[]>;
  rebalanceFloor: () => Promise<{
    reassignedCount: number;
    message: string;
    jobs: Job[];
  }>;
  getJobById: (id: string) => Job | undefined;
  /** Full record including the job card — the list projection omits it. */
  loadJobDetail: (id: string) => Promise<Job>;
  createJobFromUi: (job: Job, files?: File[]) => Promise<Job>;
  updateJob: (
    job: Job,
    audit?: JobUpdateAuditAction,
    auditDetail?: string | null
  ) => Promise<Job>;
  /**
   * Change only the job's status — a minimal `{id, stageStatusLabel}` body,
   * not the whole job. Unlike `updateJob`, this cannot be broken by unrelated
   * bad data sitting on other fields (dueDate, estimatedHours, ...), because
   * those fields are never part of the request.
   */
  updateJobStatus: (job: Job, status: Job["status"]) => Promise<Job>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The staff roster comes from `GET /users`.
 *
 * Rev 2 §03 is explicit that this "replaces the prototype's staff / directors
 * side-load". Certifications and shift capacity are placeholders until
 * `fabricator_profile` (Rev 2 §01) is exposed — the fields exist on the UI type
 * but no endpoint serves them yet.
 */
function usersToStaff(users: UserDTO[]): DbStaffRow[] {
  return users
    .filter((u) => u.id != null && u.enabled !== false)
    .map((u) => {
      const name = u.displayName?.trim() || u.email || `User ${u.id}`;
      return {
        id: String(u.id),
        display_name: name,
        initials: initialsOf(name),
        certifications: [],
        shift_hours_capacity: 8,
        is_present: true,
      };
    });
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState<JobCounts>(EMPTY_JOB_COUNTS);
  const [staff, setStaff] = useState<DbStaffRow[]>([]);
  const [directors, setDirectors] = useState<DirectorRow[]>([]);
  const [directorsLoading, setDirectorsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshJobs = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);
    try {
      // `sort` binds to the JobSort enum — "createdDate,desc" was a 400.
      const page = await listJobs(0, 200, { sort: "RECENT" });
      const list = (page.content ?? []).map(frpJobSummaryToUi);
      setJobs(list);

      // Counts are aggregated org-wide in the database, so they stay correct
      // past the page cap. Falling back to the page keeps tiles plausible if
      // the endpoint is missing, but they are then a floor, not a total.
      try {
        setCounts(countsFromDto(await getJobCounts()));
      } catch {
        setCounts(deriveFromJobs(list));
      }

      return list;
    } catch (e) {
      // A Platform Super Admin has no organization, so the job APIs have no
      // tenant to scope to. That is the only case worth swallowing — every
      // other failure must surface, including the 403 that means the org
      // admin role predates the job module and never got JOB_READ.
      if (e instanceof FrpApiError && e.status === 403) {
        setJobs([]);
        setCounts(EMPTY_JOB_COUNTS);
        setError(
          "You do not have access to jobs. If you are an organization admin, the JOB_* privileges may not be granted to your role yet."
        );
        return [];
      }
      setError(e instanceof Error ? e.message : "Could not load jobs");
      return [];
    } finally {
      if (!silent) setLoading(false);
      setHydrated(true);
    }
  }, []);

  const refreshStaff = useCallback(async () => {
    setDirectorsLoading(true);
    try {
      const page = await listUsers(0, 200);
      const roster = usersToStaff(page.content ?? []);
      setStaff(roster);
      setStaffRoster(roster);
      setDirectors(
        roster.map((s) => ({
          id: s.id,
          name: s.display_name,
          display_name: s.display_name,
          active: true,
        }))
      );
    } catch {
      // USER_READ is a separate privilege from JOB_READ; losing the roster
      // must not blank the job list.
      setStaff([]);
      setStaffRoster([]);
      setDirectors([]);
    } finally {
      setDirectorsLoading(false);
    }
  }, []);

  // Guarded by a ref, not just the empty dep array: React Strict Mode
  // (dev only) mounts every component twice, and without this the initial
  // load fires the jobs/counts/staff GETs twice on every page load.
  const initialLoadStartedRef = useRef(false);
  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void refreshJobs();
    void refreshStaff();
  }, [refreshJobs, refreshStaff]);

  /**
   * A job by job number ("JOB-Q-1255") or by database id ("448").
   *
   * Job.id is the job number, and that is what the app links by. But a
   * quotation reports its job as `jobId` - the database id - so a link from a
   * quote arrives in the other currency. Accepting both is why /jobs/448 lands
   * on the job instead of the search-jobs fallback.
   */
  const findJob = useCallback(
    (id: string) => jobs.find((j) => jobRouteMatches(j, id)),
    [jobs]
  );

  const getJobById = findJob;

  const loadJobDetail = useCallback(
    async (id: string): Promise<Job> => {
      const dbId = await resolveJobDbId(id, jobs);
      if (!dbId) {
        throw new FrpApiError(404, "Job not found");
      }
      const full = frpJobToUi(await getJob(dbId));
      setJobs((prev) => {
        const rest = prev.filter(
          (j) => j.id !== full.id && j.dbId !== full.dbId
        );
        return [full, ...rest];
      });
      return full;
    },
    [jobs]
  );

  const rebalanceFloor = useCallback(async () => {
    return {
      reassignedCount: 0,
      message:
        "Floor rebalance needs POST /floor/rebalance (Rev 2 §13, FLOOR_REBALANCE) — not built on the backend yet.",
      jobs,
    };
  }, [jobs]);

  /**
   * Create the job, attach any create-drawer files as job-level Others
   * (`attachToJob=true` → SharePoint Other folder), then save the job card.
   */
  const createJobFromUi = useCallback(async (job: Job, files: File[] = []): Promise<Job> => {
    const created = await createJob(uiJobToCreateRequest(job));
    if (created.id == null) {
      throw new Error("Backend created the job without an id.");
    }

    let uploadError: string | null = null;
    if (files.length > 0) {
      const uploads = await Promise.allSettled(
        files.map((file) =>
          uploadJobDocument(created.id as number, {
            attachToJob: true,
            file,
            documentName: file.name,
          })
        )
      );
      const failed = uploads.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        uploadError = `Job created, but ${failed} of ${files.length} file${files.length > 1 ? "s" : ""} failed to upload.`;
      }
    }

    const withCard = await saveJobCard(created.id, uiJobToJobCardPayload(job));
    const ui = frpJobToUi(withCard);
    setJobs((prev) => [ui, ...prev.filter((j) => j.id !== ui.id)]);
    if (uploadError) throw new Error(uploadError);
    return ui;
  }, []);

  /**
   * Save a job.
   *
   * Field edits go through `PUT /jobs`; the card and the customer/logistics
   * panels go through their own endpoints; a status change goes through the
   * stage service, because `stageStatus` is a cache with exactly one writer.
   * Writes are last-write-wins - there is no version token to chain on.
   */
  const updateJob = useCallback(
    async (
      job: Job,
      audit?: JobUpdateAuditAction,
      auditDetail?: string | null
    ): Promise<Job> => {
      // PUT /jobs also applies a status change — it rewrites the stages and
      // recomputes the status from them.
      const saved = await updateJobApi(uiJobToUpdateRequest(job));

      let latest = saved;
      if (job.printDetails && latest.id != null) {
        latest = await saveJobCard(latest.id, uiJobToJobCardPayload(job));
      }

      // The customer and logistics panels are persisted through their own
      // endpoints (no longer folded into the PUT /jobs body). Order does not
      // matter for correctness - writes are last-write-wins.
      const contactDetails = uiJobToContactDetails(job);
      if (contactDetails.companyName && latest.id != null) {
        latest = await saveContactDetails(latest.id, contactDetails);
      }
      const schedulingLogistics = schedulingLogisticsToBackend(
        job.schedulingLogistics
      );
      if (schedulingLogistics && latest.id != null) {
        latest = await saveSchedulingLogistics(latest.id, schedulingLogistics);
      }

      const ui = frpJobToUi(latest);
      setJobs((prev) => prev.map((j) => (j.id === ui.id ? ui : j)));
      // `audit` / `auditDetail` are recorded by the backend from what changed
      // (JobAuditEvent). Kept in the signature so call sites stay unchanged.
      void audit;
      void auditDetail;
      return ui;
    },
    []
  );

  const updateJobStatus = useCallback(
    async (job: Job, status: Job["status"]): Promise<Job> => {
      if (job.dbId == null) {
        throw new Error(`Job ${job.id} has no database id — cannot update.`);
      }
      const saved = await updateJobApi({
        id: Number(job.dbId),
        stageStatusLabel: statusToBackend(status) ?? undefined,
      });
      const ui = frpJobToUi(saved);
      setJobs((prev) => prev.map((j) => (j.id === ui.id ? ui : j)));
      return ui;
    },
    []
  );

  const value = useMemo(
    () => ({
      jobs,
      counts,
      staff,
      directors,
      directorsLoading,
      hydrated,
      loading,
      error,
      refreshJobs,
      rebalanceFloor,
      getJobById,
      loadJobDetail,
      createJobFromUi,
      updateJob,
      updateJobStatus,
    }),
    [
      jobs,
      counts,
      staff,
      directors,
      directorsLoading,
      hydrated,
      loading,
      error,
      refreshJobs,
      rebalanceFloor,
      getJobById,
      loadJobDetail,
      createJobFromUi,
      updateJob,
      updateJobStatus,
    ]
  );

  return (
    <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error("useJobs must be used within JobsProvider");
  }
  return ctx;
}
