import { QuoteDetailPage } from "@/components/QuoteDetailPage";
import { RequireAccess } from "@/components/RequireAccess";
import { ACCESS_KEYS } from "@/lib/frp/access";

interface PageProps {
  params: Promise<{ quoteNumber: string }>;
}

export default async function QuoteDetailRoutePage({ params }: PageProps) {
  const { quoteNumber } = await params;
  return (
    <RequireAccess accessKey={ACCESS_KEYS.QUOTES_VIEW}>
      <QuoteDetailPage quoteNumber={decodeURIComponent(quoteNumber)} />
    </RequireAccess>
  );
}
