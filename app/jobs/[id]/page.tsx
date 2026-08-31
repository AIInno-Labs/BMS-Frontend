import { Suspense } from "react";
import { JobCard } from "@/components/JobCard";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

function JobCardLoading() {
  return (
    <main className="flex min-h-[40vh] items-center justify-center bg-[#121212]">
      <p className="text-base text-orange-200">Loading job dashboard...</p>
    </main>
  );
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  return (
    <RequireAccess accessKey={ACCESS_KEYS.JOBS_VIEW}>
      <Suspense fallback={<JobCardLoading />}>
        <JobCard jobId={decodeURIComponent(id)} />
      </Suspense>
    </RequireAccess>
  );
}
