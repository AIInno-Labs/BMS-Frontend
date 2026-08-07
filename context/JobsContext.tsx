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
import { FrpApiError, type UserDTO } from "@/lib/frp/types";
import type { DbStaffRow } from "@/lib/floorOps";
import { setStaffRoster } from "@/lib/workers";
import type { Job } from "@/lib/types";

export type { JobUpdateAuditAction };

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
  createJobFromUi: (job: Job) => Promise<Job>;
  updateJob: (
    job: Job,
    audit?: JobUpdateAuditAction,
    auditDetail?: string | null
  ) => Promise<Job>;
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

  const getJobById = useCallback(
    (id: string) => jobs.find((j) => j.id === id),
    [jobs]
  );

  const loadJobDetail = useCallback(
    async (id: string): Promise<Job> => {
      const known = jobs.find((j) => j.id === id);
      if (!known?.dbId) {
        throw new Error(`Job ${id} is not loaded — refresh the job list first.`);
      }
      const full = frpJobToUi(await getJob(known.dbId));
      setJobs((prev) => prev.map((j) => (j.id === full.id ? full : j)));
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
   * Create, then save the job card.
   *
   * Two calls because `POST /jobs` does not accept a card — it seeds an empty
   * one, and the card is replaced as a unit through its own endpoint. The
   * customer is resolved backend-side from `customerCompanyName`; there is no
   * `/customers` endpoint to call first.
   */
  const createJobFromUi = useCallback(async (job: Job): Promise<Job> => {
    const created = await createJob(uiJobToCreateRequest(job));
    if (created.id == null || created.version == null) {
      throw new Error("Backend created the job without an id or version.");
    }
    const withCard = await saveJobCard(
      created.id,
      created.version,
      uiJobToJobCardPayload(job)
    );
    const ui = frpJobToUi(withCard);
    setJobs((prev) => [ui, ...prev.filter((j) => j.id !== ui.id)]);
    return ui;
  }, []);

  /**
   * Save a job.
   *
   * Field edits go through `PUT /jobs`; the card goes through its own endpoint;
   * a status change goes through the stage service, because `stageStatus` is a
   * cache with exactly one writer. Each step returns a fresh `version`, so they
   * are chained rather than issued in parallel.
   */
  const updateJob = useCallback(
    async (
      job: Job,
      audit?: JobUpdateAuditAction,
      auditDetail?: string | null
    ): Promise<Job> => {
      // One call. PUT /jobs now applies a status change too — it rewrites the
      // stages and recomputes the status from them — so this no longer moves a
      // stage first and then re-reads the version the move had bumped.
      const saved = await updateJobApi(uiJobToUpdateRequest(job));

      let latest = saved;
      if (job.printDetails && latest.id != null && latest.version != null) {
        latest = await saveJobCard(
          latest.id,
          latest.version,
          uiJobToJobCardPayload(job)
        );
      }

      // The customer and logistics panels are persisted through their own
      // endpoints, each chained on the version the previous call returned - the
      // same pattern as the job card above. They are no longer folded into the
      // PUT /jobs body (see uiJobToUpdateRequest).
      const contactDetails = uiJobToContactDetails(job);
      if (contactDetails.companyName && latest.id != null && latest.version != null) {
        latest = await saveContactDetails(latest.id, latest.version, contactDetails);
      }
      const schedulingLogistics = schedulingLogisticsToBackend(
        job.schedulingLogistics
      );
      if (schedulingLogistics && latest.id != null && latest.version != null) {
        latest = await saveSchedulingLogistics(
          latest.id,
          latest.version,
          schedulingLogistics
        );
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
