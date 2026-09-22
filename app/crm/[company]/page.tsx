import { CrmPage } from "@/components/CrmPage";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

interface PageProps {
  params: Promise<{ company: string }>;
}

export default async function CrmCompanyRoutePage({ params }: PageProps) {
  const { company } = await params;
  return (
    <RequireAccess accessKey={ACCESS_KEYS.CUSTOMERS_VIEW}>
      <CrmPage company={decodeURIComponent(company)} />
    </RequireAccess>
  );
}
