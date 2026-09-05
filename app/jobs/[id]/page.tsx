import { Suspense } from "react";
import { JobCard } from "@/components/JobCard";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";
import { Spinner } from "@/components/ui/Loading";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

function JobCardLoading() {
  return (
    <main className="flex min-h-[40vh] items-center justify-center bg-[#121212]">
      <Spinner size="lg" className="text-orange-200" />
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
