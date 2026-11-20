import { AnalyticsPage } from "@/components/AnalyticsPage";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

export default function AnalyticsRoutePage() {
  return (
    <RequireAccess accessKey={ACCESS_KEYS.ANALYTICS_VIEW}>
      <AnalyticsPage />
    </RequireAccess>
  );
}
