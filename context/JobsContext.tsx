"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DbStaffRow } from "@/lib/floorOps";
import type { DirectorRow } from "@/lib/supabase/directors-repository";
import { setStaffRoster } from "@/lib/workers";
import type { JobUpdateAuditAction } from "@/lib/supabase/jobs-repository";
import type { Job } from "@/lib/types";

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
  updateJob: (
    job: Job,
    audit?: JobUpdateAuditAction,
    auditDetail?: string | null
  ) => Promise<Job>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

async function fetchJobsFromApi(): Promise<{
  jobs: Job[];
  staff: DbStaffRow[];
  directors: DirectorRow[];
}> {
  const res = await fetch("/api/jobs", { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load jobs (${res.status})`);
  }
  const data = (await res.json()) as {
    jobs: Job[];
    staff?: DbStaffRow[];
    directors?: DirectorRow[];
  };
  return {
    jobs: data.jobs,
    staff: data.staff ?? [],
    directors: data.directors ?? [],
  };
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<DbStaffRow[]>([]);
  const [directors, setDirectors] = useState<DirectorRow[]>([]);
  const [directorsLoading, setDirectorsLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshJobs = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setDirectorsLoading(true);
    setError(null);
    try {
      const { jobs: list, staff: roster, directors: directorList } =
        await fetchJobsFromApi();
      setJobs(list);
      setStaff(roster);
      setDirectors(directorList);
      setStaffRoster(roster);
      return list;
    } catch (e) {
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
    const res = await fetch("/api/floor/rebalance", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error ?? `Rebalance failed (${res.status})`);
    }
    const data = body as {
      jobs: Job[];
      staff?: DbStaffRow[];
      reassignedCount: number;
      message: string;
    };
    setJobs(data.jobs);
    if (data.staff?.length) {
      setStaff(data.staff);
      setStaffRoster(data.staff);
    }
    return {
      reassignedCount: data.reassignedCount ?? 0,
      message: data.message ?? "Floor rebalanced.",
      jobs: data.jobs,
    };
  }, []);

  const updateJob = useCallback(
    async (
      job: Job,
      audit?: JobUpdateAuditAction,
      auditDetail?: string | null
    ): Promise<Job> => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job,
        audit: audit ?? "job_card_saved",
        ...(auditDetail !== undefined ? { auditDetail } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Save failed (${res.status})`);
    }
    const data = (await res.json()) as { job: Job };
    setJobs((prev) => prev.map((j) => (j.id === data.job.id ? data.job : j)));
    return data.job;
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
