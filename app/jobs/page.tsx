import { JobsPageContent } from "@/components/JobsPageContent";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

export default function JobsPage() {
  return (
    <RequireAccess accessKey={ACCESS_KEYS.JOBS_VIEW}>
      <JobsPageContent />
    </RequireAccess>
  );
}
