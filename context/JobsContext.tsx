"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createJob,
  findOrCreateCustomer,
  listJobs,
  updateJobApi,
} from "@/lib/frp/api";
import {
  frpJobToUi,
  type JobUpdateAuditAction,
  uiJobToCreateRequest,
  uiJobToUpdateRequest,
} from "@/lib/frp/job-mapper";
import { FrpApiError } from "@/lib/frp/types";
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
  createJobFromUi: (job: Job) => Promise<Job>;
  updateJob: (
    job: Job,
    audit?: JobUpdateAuditAction,
    auditDetail?: string | null
  ) => Promise<Job>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

async function fetchJobsFromFrp(): Promise<Job[]> {
  const page = await listJobs(0, 500, { sort: "createdDate,desc" });
  return (page.content ?? []).map(frpJobToUi);
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
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
      const list = await fetchJobsFromFrp();
      setJobs(list);
      // Staff / directors move with DEL-01 floor features; empty until then.
      setStaff([]);
      setDirectors([]);
      setStaffRoster([]);
      return list;
    } catch (e) {
      // Platform Super Admin has no org — jobs APIs require a tenant.
      if (
        e instanceof FrpApiError &&
        (e.status === 403 || e.status === 401 || e.status === 500)
      ) {
        setJobs([]);
        setError(null);
        return [];
      }
      setError(e instanceof Error ? e.message : "Could not load jobs");
      return [];
    } finally {
      if (!silent) setLoading(false);
      setDirectorsLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const getJobById = useCallback(
    (id: string) => jobs.find((j) => j.id === id),
    [jobs]
  );

  const rebalanceFloor = useCallback(async () => {
    return {
      reassignedCount: 0,
      message: "Floor rebalance is not available until staff APIs move to Spring Boot.",
      jobs,
    };
  }, [jobs]);

  const createJobFromUi = useCallback(async (job: Job): Promise<Job> => {
    const customer = await findOrCreateCustomer({
      name: job.clientName,
      contactName: job.clientContactName,
      email: job.printDetails?.contactEmail,
      phone: job.printDetails?.contactPhone,
    });
    if (customer.id == null) {
      throw new Error("Customer was created without an id");
    }
    const created = await createJob(uiJobToCreateRequest(job, customer.id));
    // Persist job-card fields that create doesn't accept.
    const patched = await updateJobApi(
      created.jobNumber ?? job.id,
      uiJobToUpdateRequest(job, "job_card_saved")
    );
    const ui = frpJobToUi(patched);
    setJobs((prev) => [ui, ...prev.filter((j) => j.id !== ui.id)]);
    return ui;
  }, []);

  const updateJob = useCallback(
    async (
      job: Job,
      audit?: JobUpdateAuditAction,
      auditDetail?: string | null
    ): Promise<Job> => {
      const saved = await updateJobApi(
        job.id,
        uiJobToUpdateRequest(job, audit, auditDetail)
      );
      const ui = frpJobToUi(saved);
      setJobs((prev) => prev.map((j) => (j.id === ui.id ? ui : j)));
      return ui;
    },
    []
  );

  const value = useMemo(
    () => ({
      jobs,
      staff,
      directors,
      directorsLoading,
      hydrated,
      loading,
      error,
      refreshJobs,
      rebalanceFloor,
      getJobById,
      createJobFromUi,
      updateJob,
    }),
    [
      jobs,
      staff,
      directors,
      directorsLoading,
      hydrated,
      loading,
      error,
      refreshJobs,
      rebalanceFloor,
      getJobById,
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
