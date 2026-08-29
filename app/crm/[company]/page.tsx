import { CrmPage } from "@/components/CrmPage";

interface PageProps {
  params: Promise<{ company: string }>;
}

export default async function CrmCompanyRoutePage({ params }: PageProps) {
  const { company } = await params;
  return <CrmPage company={decodeURIComponent(company)} />;
}
