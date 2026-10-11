import { QuoteDetailPage } from "@/components/QuoteDetailPage";

interface PageProps {
  params: Promise<{ quoteNumber: string }>;
}

export default async function QuoteDetailRoutePage({ params }: PageProps) {
  const { quoteNumber } = await params;
  return <QuoteDetailPage quoteNumber={decodeURIComponent(quoteNumber)} />;
}
